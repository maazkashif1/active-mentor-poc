import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { submitResult, uploadVideoToR2 } from '../../services/prescriptionService';
import MultiPoseCamera, { MultiGesture, MultiPoseCameraHandle } from '../../pose/MultiPoseCamera';
import {
  EXERCISES, updateRep, updateAdaptive, resolveThresholds, validateSavedTarget,
  initialRepState, initialAdaptiveState,
  DEFAULT_ADAPTIVE_CONFIG, RepState, Side,
} from '../../pose/poseMath';

const DEBUG_POSE = __DEV__;

// ── Calibration ───────────────────────────────────────────────────────────────
// 1.5 s measurement of resting arm angle. Timer fires via setTimeout (not frame
// delivery) so it's immune to stale closures in the frame processor worklet.
// onFrame only collects angles into a ref — no timer logic inside the callback.
const CALIBRATION_MS = 1500;
const CALIBRATION_MIN_FRAMES = 10;  // ~10fps worst case × 1.5s
const CALIBRATION_MAX_STDDEV = 10;  // generous — breathing/pose jitter is real
const CALIBRATION_MAX_REST = 40;
const CALIBRATION_MAX_RETRIES = 2;

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const CONFIDENCE_FLOOR = 0.3;
const SIDES: { key: Side; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
];
const ANGLE_EMA = 0.35; // second smoothing pass for display (first pass is in MultiPoseCamera)

export default function ExerciseScreen({ navigation, route }: Props) {
  const { exercise, prescription } = route.params as { exercise: any; prescription?: any };

  const def = EXERCISES[exercise?.id] ?? EXERCISES.hand_raise;
  const { effort: originalEffort, rest: prescriptionRest } = useMemo(
    () => resolveThresholds(def, prescription),
    [def, prescription],
  );

  // `rest` is updated after calibration. `minAdaptedAngle` always derives from
  // current `rest` so it tracks the calibrated value through the session.
  const [rest, setRest] = useState(prescriptionRest);
  const minAdaptedAngle = prescription?.minAdaptedAngle ?? (rest + 10);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [side, setSide] = useState<Side>('both');
  const [active, setActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibFailed, setCalibFailed] = useState(false);
  const [calibProgress, setCalibProgress] = useState(0); // 0..CALIBRATION_MS
  const [reps, setReps] = useState(0);
  const [assistedReps, setAssistedReps] = useState(0);
  const [angle, setAngle] = useState<number | null>(null);
  const [rawAngle, setRawAngle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [effectiveEffort, setEffectiveEffort] = useState(originalEffort);
  const [adaptedTarget, setAdaptedTarget] = useState<number | null>(null);
  const [debugPeak, setDebugPeak] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const repRef = useRef<RepState>(initialRepState);
  const assistRef = useRef(false);
  const adaptiveRef = useRef(initialAdaptiveState);
  const smoothedAngleRef = useRef<number | null>(null);
  const repPeaksRef = useRef<number[]>([]);
  // Calibration — timer-driven (not frame-driven) to avoid stale closure issues
  const calibFramesRef = useRef<number[]>([]);
  const calibDoneRef = useRef(false);
  const calibAttemptRef = useRef(0);
  const restCalibratedRef = useRef(false);
  const calibTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirrors so onFrame never needs to capture state in its closure
  const isCalibRef = useRef(false);
  const isActiveRef = useRef(false);
  // Recording
  const cameraRef = useRef<MultiPoseCameraHandle>(null);
  const videoReadyRef = useRef<((path: string | null) => void) | null>(null);

  // ── Frame callback ────────────────────────────────────────────────────────
  // Uses refs only — no state captured — so the worklet never holds a stale
  // version of this function when calibrating/active flips.
  const onFrame = useCallback((g: MultiGesture) => {
    if (g.angle != null) {
      const prev = smoothedAngleRef.current;
      smoothedAngleRef.current = prev == null
        ? g.angle
        : ANGLE_EMA * g.angle + (1 - ANGLE_EMA) * prev;
    }
    if (smoothedAngleRef.current != null) setAngle(Math.round(smoothedAngleRef.current));

    // Calibration: just collect frames. Timer (setTimeout) drives completion.
    if (isCalibRef.current) {
      if (g.angle != null && !calibDoneRef.current) calibFramesRef.current.push(g.angle);
      return;
    }

    if (!isActiveRef.current) return;

    // ── Exercise ──────────────────────────────────────────────────────────────
    if (DEBUG_POSE && g.angle != null) setRawAngle(Math.round(g.angle));

    const prevRepState = repRef.current;
    const nextRepState = updateRep(prevRepState, g.atEffort, g.atRest, Date.now());
    const repJustCounted = nextRepState.reps > prevRepState.reps;

    if (prevRepState.phase === 'rest' && nextRepState.phase === 'effort') assistRef.current = g.assisted;
    if (nextRepState.phase === 'effort' && g.assisted) assistRef.current = true;

    if (repJustCounted) {
      setReps(nextRepState.reps);
      if (assistRef.current) setAssistedReps(a => a + 1);
      repPeaksRef.current = [...repPeaksRef.current, Math.round(adaptiveRef.current.peakThisAttempt)];
      assistRef.current = false;
    }
    repRef.current = nextRepState;

    if (def.effort === 'increase' && g.angle != null) {
      const prevAdaptive = adaptiveRef.current;
      const nextAdaptive = updateAdaptive(
        prevAdaptive,
        g.angle,              // keypoint-EMA (not double-smoothed) for accurate peaks
        repJustCounted,
        g.atRest,
        originalEffort,
        minAdaptedAngle,
        rest + 5,             // attemptThreshold
        DEFAULT_ADAPTIVE_CONFIG,
        Date.now(),
      );
      adaptiveRef.current = nextAdaptive;

      if (nextAdaptive.adaptedTarget !== prevAdaptive.adaptedTarget && nextAdaptive.adaptedTarget != null) {
        setEffectiveEffort(nextAdaptive.adaptedTarget);
        setAdaptedTarget(nextAdaptive.adaptedTarget);
      }

      if (DEBUG_POSE) setDebugPeak(Math.round(nextAdaptive.peakThisAttempt));
    }
  }, [def, originalEffort, minAdaptedAngle]);  // no state — refs keep it stable

  const beginRecording = useCallback(() => {
    cameraRef.current?.startRecording({
      onRecordingFinished: (path) => {
        if (videoReadyRef.current) videoReadyRef.current(path);
      },
      onRecordingError: () => {
        if (videoReadyRef.current) videoReadyRef.current(null);
      },
    });
  }, []);

  // Evaluates collected frames and transitions state. Called by setTimeout.
  const finishCalib = useCallback(() => {
    if (calibDoneRef.current) return;
    calibDoneRef.current = true;
    isCalibRef.current = false;
    const frames = calibFramesRef.current;
    let succeeded = false;
    if (frames.length >= CALIBRATION_MIN_FRAMES) {
      const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
      const variance = frames.reduce((a, b) => a + (b - mean) ** 2, 0) / frames.length;
      if (Math.sqrt(variance) <= CALIBRATION_MAX_STDDEV && mean >= 0 && mean <= CALIBRATION_MAX_REST) {
        setRest(Math.round(mean));
        restCalibratedRef.current = true;
        succeeded = true;
      }
    }
    if (succeeded) {
      isActiveRef.current = true;
      setCalibrating(false);
      setActive(true);
      beginRecording();
    } else if (calibAttemptRef.current < CALIBRATION_MAX_RETRIES) {
      setCalibrating(false);
      setCalibFailed(true);
    } else {
      restCalibratedRef.current = false;
      isActiveRef.current = true;
      setCalibrating(false);
      setActive(true);
      beginRecording();
    }
  }, [beginRecording]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const startCalibTimer = useCallback(() => {
    if (calibTimerRef.current) clearTimeout(calibTimerRef.current);
    calibTimerRef.current = setTimeout(finishCalib, CALIBRATION_MS);
  }, [finishCalib]);

  const start = () => {
    const validSaved = validateSavedTarget(
      prescription?.currentAdaptedAngle,
      originalEffort,
      prescription?.minAdaptedAngle ?? (prescriptionRest + 10),
    );

    repRef.current = initialRepState;
    adaptiveRef.current = { ...initialAdaptiveState, adaptedTarget: validSaved };
    smoothedAngleRef.current = null;
    repPeaksRef.current = [];
    assistRef.current = false;
    calibFramesRef.current = [];
    calibDoneRef.current = false;
    calibAttemptRef.current = 0;
    restCalibratedRef.current = false;
    isCalibRef.current = true;
    isActiveRef.current = false;
    videoReadyRef.current = null;

    setReps(0); setAssistedReps(0); setAngle(null); setRawAngle(null);
    setEffectiveEffort(validSaved ?? originalEffort);
    setAdaptedTarget(validSaved);
    setDebugPeak(0);
    setCalibProgress(0);
    setCalibFailed(false);
    setRest(prescriptionRest);
    setCalibrating(true);
    startCalibTimer();
  };

  const retryCalibration = () => {
    calibAttemptRef.current += 1;
    calibFramesRef.current = [];
    calibDoneRef.current = false;
    smoothedAngleRef.current = null;
    isCalibRef.current = true;
    setCalibProgress(0);
    setCalibFailed(false);
    setCalibrating(true);
    startCalibTimer();
  };

  const useDefaultRest = () => {
    if (calibTimerRef.current) clearTimeout(calibTimerRef.current);
    calibDoneRef.current = true;
    isCalibRef.current = false;
    isActiveRef.current = true;
    restCalibratedRef.current = false;
    setCalibFailed(false);
    setActive(true);
    beginRecording();
  };

  // Drive the progress bar independently of frame delivery
  useEffect(() => {
    if (!calibrating) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      setCalibProgress(Math.min(elapsed, CALIBRATION_MS));
      if (elapsed >= CALIBRATION_MS) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [calibrating]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (calibTimerRef.current) clearTimeout(calibTimerRef.current); }, []);

  const finish = async () => {
    isActiveRef.current = false;
    setActive(false);
    setSubmitting(true);

    // Stop recording and wait for the file path (5 s timeout, non-fatal)
    let videoUrl: string | undefined;
    if (cameraRef.current) {
      try {
        const videoPath = await new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 5000);
          videoReadyRef.current = (path) => { clearTimeout(timeout); resolve(path); };
          cameraRef.current!.stopRecording();
        });
        videoReadyRef.current = null;
        if (videoPath) videoUrl = await uploadVideoToR2(videoPath);
      } catch {
        // non-fatal — result still submitted without video
      }
    }

    const { adaptedTarget: finalAdapted, adaptationEvents } = adaptiveRef.current;
    if (prescription && reps > 0) {
      try {
        await submitResult(
          prescription._id,
          reps,
          Math.round((reps / prescription.targetReps) * 100),
          assistedReps,
          def.effort === 'increase' ? originalEffort : undefined,
          finalAdapted ?? undefined,
          repPeaksRef.current.length ? repPeaksRef.current : undefined,
          adaptationEvents.length ? adaptationEvents : undefined,
          rest,
          restCalibratedRef.current,
          videoUrl,
        );
      } catch {}
    }
    setSubmitting(false);
    navigation.navigate('ExerciseSummary', {
      exercise, reps, assistedReps, prescription,
      originalTargetAngle: def.effort === 'increase' ? originalEffort : undefined,
      adaptedTargetAngle: finalAdapted ?? undefined,
      repPeakAngles: repPeaksRef.current,
      adaptationEvents,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Idle screen — no camera
  if (!active && !calibrating && !calibFailed) {
    return (
      <View style={s.center}>
        <Text style={s.exTitle}>{exercise.name}</Text>
        <Text style={s.detail}>
          {prescription ? `Target: ${prescription.targetReps} reps · ` : ''}
          Reach {Math.round(effectiveEffort)}°
          {prescription?.currentAdaptedAngle != null && validateSavedTarget(prescription.currentAdaptedAngle, originalEffort, prescription?.minAdaptedAngle ?? (prescriptionRest + 10)) != null
            ? ' (saved)'
            : ''
          } · return to {Math.round(prescriptionRest)}°
        </Text>
        <Text style={s.sideLabel}>Which side?</Text>
        <View style={s.sideRow}>
          {SIDES.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[s.sideBtn, side === opt.key && s.sideBtnOn]}
              onPress={() => setSide(opt.key)}>
              <Text style={[s.sideBtnText, side === opt.key && s.sideBtnTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btn} onPress={start}>
          <Text style={s.btnText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera screen (calibrating | calibFailed | active)
  const target = prescription?.targetReps;
  const done = active && target != null && reps >= target;
  const independent = reps - assistedReps;
  const retriesLeft = CALIBRATION_MAX_RETRIES - calibAttemptRef.current;

  return (
    <View style={s.container}>
      <MultiPoseCamera
        ref={cameraRef}
        def={def}
        side={side}
        effort={effectiveEffort}
        rest={rest}
        floor={CONFIDENCE_FLOOR}
        isActive={active || calibrating || calibFailed}
        onFrame={onFrame}
      />

      {/* ── Calibration measuring overlay ── */}
      {calibrating && (
        <View style={s.calibOverlay} pointerEvents="none">
          <Text style={s.calibTitle}>Let your arm hang relaxed by your side</Text>
          <Text style={s.calibAngle}>{angle != null ? `${angle}°` : '—'}</Text>
          <View style={s.calibBar}>
            <View style={[s.calibFill, { width: `${Math.round((calibProgress / CALIBRATION_MS) * 100)}%` }]} />
          </View>
          <Text style={s.calibHint}>Measuring resting angle…</Text>
        </View>
      )}

      {/* ── Calibration retry overlay ── */}
      {calibFailed && (
        <View style={s.calibRetryOverlay}>
          <Text style={s.calibRetryTitle}>Couldn't measure resting angle</Text>
          <Text style={s.calibRetryAngle}>{angle != null ? `${angle}°` : '—'}</Text>
          <Text style={s.calibRetryHint}>
            Arm may be moving or out of frame. Let it hang fully relaxed.
          </Text>
          {retriesLeft > 0 && (
            <TouchableOpacity style={[s.btn, s.btnSmall]} onPress={retryCalibration}>
              <Text style={s.btnText}>Retry ({retriesLeft} left)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btnOutline, s.btnSmall]} onPress={useDefaultRest}>
            <Text style={s.btnOutlineText}>Use default ({prescriptionRest}°)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Exercise overlays (active only) ── */}
      {active && (
        <>
          <View style={s.overlay} pointerEvents="none">
            <Text style={[s.repCount, done && s.repCountDone]}>{reps}</Text>
            <Text style={s.repLabel}>reps{target != null ? ` / ${target}` : ''}</Text>
            <Text style={s.breakdown}>{independent} independent · {assistedReps} assisted</Text>
            <Text style={s.angleDisplay}>{angle != null ? `${angle}°` : 'tap yourself to lock in'}</Text>
            {adaptedTarget != null && (
              <Text style={s.adaptedBadge}>Adapted target: {Math.round(adaptedTarget)}°</Text>
            )}
          </View>

          {DEBUG_POSE && (
            <View style={s.debugPanel} pointerEvents="none">
              <Text style={s.debugTitle}>DEBUG POSE</Text>
              <Text style={s.debugLine}>Raw (kp-EMA): {rawAngle ?? '—'}°</Text>
              <Text style={s.debugLine}>Smooth (display): {angle ?? '—'}°</Text>
              <Text style={s.debugLine}>Rest (calib{restCalibratedRef.current ? '✓' : '✗'}): {rest}°</Text>
              <Text style={s.debugLine}>Target: {Math.round(effectiveEffort)}°
                {adaptedTarget != null ? ` (↓ from ${Math.round(originalEffort)}°)` : ''}
              </Text>
              <Text style={s.debugLine}>Peak this rep (raw): {debugPeak}°</Text>
              <Text style={s.debugLine}>Reps: {reps}</Text>
              <Text style={s.debugLine}>
                Failed peaks: [{adaptiveRef.current.recentFailedPeaks.map(p => Math.round(p)).join(', ')}]
              </Text>
              <Text style={s.debugLine}>Events: {adaptiveRef.current.adaptationEvents.length}</Text>
            </View>
          )}

          <View style={s.controls}>
            <TouchableOpacity style={s.doneBtn} onPress={finish} disabled={submitting}>
              <Text style={s.doneBtnText}>{submitting ? 'Saving…' : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 },
  exTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  detail: { color: '#888', fontSize: 14, marginBottom: 28, textAlign: 'center' },
  sideLabel: { color: '#aaa', fontSize: 13, marginBottom: 10 },
  sideRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  sideBtn: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  sideBtnOn: { backgroundColor: '#EC9F05', borderColor: '#EC9F05' },
  sideBtnText: { color: '#ccc', fontSize: 15, fontWeight: '600' },
  sideBtnTextOn: { color: '#000' },
  btn: { backgroundColor: '#EC9F05', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 40 },
  btnSmall: { paddingVertical: 12, paddingHorizontal: 28, marginTop: 12 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  btnOutline: { borderWidth: 1, borderColor: '#EC9F05', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 40 },
  btnOutlineText: { color: '#EC9F05', fontWeight: 'bold', fontSize: 15 },
  // Calibration overlays
  calibOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  calibTitle: { color: '#fff', fontSize: 19, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  calibAngle: { color: '#EC9F05', fontSize: 52, fontWeight: 'bold', marginBottom: 20 },
  calibBar: { width: 200, height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  calibFill: { height: '100%', backgroundColor: '#EC9F05', borderRadius: 3 },
  calibHint: { color: '#aaa', fontSize: 13 },
  calibRetryOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', padding: 32,
  },
  calibRetryTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  calibRetryAngle: { color: '#EC9F05', fontSize: 40, fontWeight: 'bold', marginBottom: 8 },
  calibRetryHint: { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  // Exercise overlays
  overlay: { position: 'absolute', top: 54, alignSelf: 'center', alignItems: 'center' },
  repCount: { color: '#EC9F05', fontSize: 72, fontWeight: 'bold' },
  repCountDone: { color: '#4CAF50' },
  repLabel: { color: '#fff', fontSize: 18 },
  breakdown: { color: '#bbb', fontSize: 14, marginTop: 4 },
  angleDisplay: { color: '#aaa', fontSize: 15, marginTop: 6 },
  adaptedBadge: { color: '#EC9F05', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  debugPanel: {
    position: 'absolute', bottom: 90, left: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1, borderColor: '#EC9F05',
    borderRadius: 8, padding: 10, minWidth: 240,
  },
  debugTitle: { color: '#EC9F05', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  debugLine: { color: '#fff', fontSize: 12, lineHeight: 18 },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  doneBtn: { flex: 1, backgroundColor: '#CC2222', borderRadius: 20, padding: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
