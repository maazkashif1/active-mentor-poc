import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

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
  const insets = useSafeAreaInsets();
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
      <View style={[s.center, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar barStyle="dark-content" />
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
              onPress={() => setSide(opt.key)}
              activeOpacity={0.85}
            >
              <Text style={[s.sideBtnText, side === opt.key && s.sideBtnTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btn} onPress={start} activeOpacity={0.85}>
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
      <StatusBar barStyle={calibFailed ? 'dark-content' : 'light-content'} />
      {/* Stay mounted on fail so Retry / Use default can resume recording; opaque sheet covers camera status text */}
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
          <View style={s.calibCard}>
            <Text style={s.calibTitle}>Let your arm hang relaxed by your side</Text>
            <Text style={s.calibAngle}>{angle != null ? `${angle}°` : '—'}</Text>
            <View style={s.calibBar}>
              <View style={[s.calibFill, { width: `${Math.round((calibProgress / CALIBRATION_MS) * 100)}%` }]} />
            </View>
            <Text style={s.calibHint}>Measuring resting angle…</Text>
          </View>
        </View>
      )}

      {/* ── Calibration retry — solid light sheet (no camera text underneath) ── */}
      {calibFailed && (
        <View style={[s.calibRetryOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
          <Text style={s.calibRetryEyebrow}>Calibration</Text>
          <Text style={s.calibRetryTitle}>Couldn't measure resting angle</Text>
          <Text style={s.calibRetryAngle}>{angle != null ? `${angle}°` : '—'}</Text>
          <Text style={s.calibRetryHint}>
            Arm may be moving or out of frame. Let it hang fully relaxed.
          </Text>
          {retriesLeft > 0 && (
            <TouchableOpacity style={[s.btn, s.btnSmall]} onPress={retryCalibration} activeOpacity={0.85}>
              <Text style={s.btnText}>Retry ({retriesLeft} left)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btnQuiet, s.btnSmall]} onPress={useDefaultRest} activeOpacity={0.85}>
            <Text style={s.btnQuietText}>Use default ({prescriptionRest}°)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Exercise overlays (active only) ── */}
      {active && (
        <>
          <View style={[s.overlay, { top: insets.top + 16 }]} pointerEvents="none">
            <View style={s.hudCard}>
              <Text style={[s.repCount, done && s.repCountDone]}>{reps}</Text>
              <Text style={s.repLabel}>reps{target != null ? ` / ${target}` : ''}</Text>
              <Text style={s.breakdown}>{independent} independent · {assistedReps} assisted</Text>
              <Text style={s.angleDisplay}>{angle != null ? `${angle}°` : 'tap yourself to lock in'}</Text>
              {adaptedTarget != null && (
                <Text style={s.adaptedBadge}>Adapted target: {Math.round(adaptedTarget)}°</Text>
              )}
            </View>
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

          <View style={[s.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={s.doneBtn} onPress={finish} disabled={submitting} activeOpacity={0.85}>
              <Text style={s.doneBtnText}>{submitting ? 'Saving…' : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28 * SCALE,
  },
  exTitle: {
    fontFamily: font('Medium'),
    fontSize: 28 * SCALE,
    fontWeight: '500',
    color: INK,
    marginBottom: 8 * SCALE,
  },
  detail: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 28 * SCALE,
    textAlign: 'center',
  },
  sideLabel: {
    fontFamily: font('Medium'),
    fontSize: 12 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12 * SCALE,
  },
  sideRow: { flexDirection: 'row', gap: 10 * SCALE, marginBottom: 32 * SCALE },
  sideBtn: {
    paddingVertical: 10 * SCALE,
    paddingHorizontal: 22 * SCALE,
    borderRadius: 20,
    backgroundColor: '#f3f5f8',
  },
  sideBtnOn: { backgroundColor: ACCENT },
  sideBtnText: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  sideBtnTextOn: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    color: INK,
  },
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    height: 48 * SCALE,
    paddingHorizontal: 40 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200 * SCALE,
  },
  btnSmall: { marginTop: 12 * SCALE, width: '100%', maxWidth: 280 * SCALE },
  btnText: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    fontSize: 15 * SCALE,
    color: INK,
  },
  btnQuiet: {
    borderRadius: 20,
    height: 44 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnQuietText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  calibOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 28 * SCALE,
  },
  calibCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28 * SCALE,
    paddingHorizontal: 22 * SCALE,
    alignItems: 'center',
    gap: 8 * SCALE,
  },
  calibTitle: {
    fontFamily: font('Medium'),
    fontSize: 17 * SCALE,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
    marginBottom: 8 * SCALE,
  },
  calibAngle: {
    fontFamily: font('Medium'),
    fontSize: 48 * SCALE,
    fontWeight: '500',
    color: INK,
    marginBottom: 12 * SCALE,
  },
  calibBar: {
    width: 200 * SCALE,
    height: 6,
    backgroundColor: '#f0f2f5',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8 * SCALE,
  },
  calibFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 3 },
  calibHint: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.5)',
  },
  calibRetryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32 * SCALE,
    zIndex: 20,
  },
  calibRetryEyebrow: {
    fontFamily: font('Medium'),
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8 * SCALE,
  },
  calibRetryTitle: {
    fontFamily: font('Medium'),
    fontSize: 22 * SCALE,
    fontWeight: '500',
    color: INK,
    textAlign: 'center',
    marginBottom: 12 * SCALE,
  },
  calibRetryAngle: {
    fontFamily: font('Medium'),
    fontSize: 40 * SCALE,
    fontWeight: '500',
    color: INK,
    marginBottom: 10 * SCALE,
  },
  calibRetryHint: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 21 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    textAlign: 'center',
    marginBottom: 8 * SCALE,
  },
  overlay: { position: 'absolute', alignSelf: 'center', alignItems: 'center' },
  hudCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingVertical: 16 * SCALE,
    paddingHorizontal: 24 * SCALE,
    alignItems: 'center',
    minWidth: 200 * SCALE,
  },
  repCount: {
    fontFamily: font('Medium'),
    fontSize: 56 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  repCountDone: { color: INK },
  repLabel: {
    fontFamily: font('Light'),
    fontSize: 15 * SCALE,
    color: 'rgba(51,51,51,0.55)',
  },
  breakdown: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 4 * SCALE,
  },
  angleDisplay: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.5)',
    marginTop: 6 * SCALE,
  },
  adaptedBadge: {
    fontFamily: font('Light'),
    fontSize: 12 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    marginTop: 4 * SCALE,
  },
  debugPanel: {
    position: 'absolute',
    bottom: 100 * SCALE,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 12,
    padding: 10,
    minWidth: 240,
  },
  debugTitle: {
    fontFamily: font('Medium'),
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 4,
    color: INK,
  },
  debugLine: {
    fontFamily: font('Light'),
    color: 'rgba(51,51,51,0.7)',
    fontSize: 12,
    lineHeight: 18,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  doneBtn: {
    flex: 1,
    backgroundColor: ACCENT,
    borderRadius: 20,
    height: 52 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: font('Medium'),
    fontWeight: '500',
    fontSize: 16 * SCALE,
    color: INK,
  },
});
