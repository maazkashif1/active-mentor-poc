import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import {
  Camera, useCameraDevice, useCameraPermission, useFrameOutput, HybridFrameConverter,
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { runOnJS } from 'react-native-worklets';
import {
  KP, angleAt, gesture, isAssisted, isSelfAssisted, assistTargets, Keypoint, ExerciseDef, Side,
} from './poseMath';

// MoveNet MultiPose output: [1,6,56] -> 6 people, each 17 kpts*3 + 5 bbox (score@55).
const EDGES: [number, number][] = [
  [KP.leftShoulder, KP.rightShoulder],
  [KP.leftShoulder, KP.leftElbow], [KP.leftElbow, KP.leftWrist],
  [KP.rightShoulder, KP.rightElbow], [KP.rightElbow, KP.rightWrist],
  [KP.leftShoulder, KP.leftHip], [KP.rightShoulder, KP.rightHip], [KP.leftHip, KP.rightHip],
  [KP.leftHip, KP.leftKnee], [KP.leftKnee, KP.leftAnkle],
  [KP.rightHip, KP.rightKnee], [KP.rightKnee, KP.rightAnkle],
];
const BOX_SCORE = 0.3, KP_SCORE = 0.3, EMA = 0.4, MAX_MISSED = 15;

type KPt = Keypoint;
type Track = { id: number; cx: number; cy: number; kps: KPt[]; score: number; area: number; missed: number };
type Person = { kps: KPt[]; color: string; primary: boolean };
type Angle = { x: number; y: number; deg: number };
export type MultiGesture = { atEffort: boolean; atRest: boolean; angle: number | null; assisted: boolean };

export type MultiPoseCameraHandle = {
  startRecording: (opts: {
    onRecordingFinished: (path: string) => void;
    onRecordingError: (e: any) => void;
  }) => void;
  stopRecording: () => Promise<void>;
};

type Props = {
  def: ExerciseDef;
  side: Side;
  effort: number;
  rest: number;
  floor?: number;
  assistRatio?: number;  // hand within this many shoulder-widths of a joint = assisting
  isActive?: boolean;
  onFrame: (g: MultiGesture) => void;
};

const MultiPoseCamera = React.forwardRef<MultiPoseCameraHandle, Props>((props, ref) => {
  const plugin = useTensorflowModel(require('../assets/models/movenet_multipose.tflite'), []);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission, requestPermission]);

  if (plugin.state !== 'loaded') {
    return <Center><Text style={s.txt}>Loading pose model… ({plugin.state})</Text></Center>;
  }
  if (!hasPermission) return <Center><Text style={s.txt}>Camera permission needed.</Text></Center>;
  if (!device) return <Center><Text style={s.txt}>No front camera found.</Text></Center>;

  const shape = plugin.model.inputs[0].shape;
  const H = shape[1] > 1 ? shape[1] : 256;
  const W = shape[2] > 1 ? shape[2] : 256;
  const dtype = plugin.model.inputs[0].dataType;

  return <Live {...props} ref={ref} model={plugin.model} device={device} H={H} W={W} dtype={dtype} />;
});

export default MultiPoseCamera;

const Live = React.forwardRef<MultiPoseCameraHandle, any>(
  ({ model, device, H, W, dtype, def, side, effort, rest, floor = 0.3, assistRatio = 0.6, isActive = true, onFrame }, ref) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [assistedNow, setAssistedNow] = useState(false);
  const dims = useRef({ w: 0, h: 0 });
  const cameraRef = useRef<Camera>(null);

  const tracks = useRef<Track[]>([]);
  const nextId = useRef(0);
  const primaryId = useRef(-1);
  const primaryAnchor = useRef<{ x: number; y: number } | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    startRecording: (opts) => {
      cameraRef.current?.startRecording({
        onRecordingFinished: (video) => opts.onRecordingFinished(video.path),
        onRecordingError: opts.onRecordingError,
      });
    },
    stopRecording: () => cameraRef.current?.stopRecording() ?? Promise.resolve(),
  }));

  const activeTriplets: [number, number, number][] =
    side === 'left' ? [def.left] : side === 'right' ? [def.right] : [def.left, def.right];

  const report = useCallback((out: number[]) => {
    const { w, h } = dims.current;
    if (w <= 0 || h <= 0) return;
    const maxDim = Math.max(w, h);

    // 1. Parse detections; identity anchored on the HEAD (nose + eyes).
    const dets: { cx: number; cy: number; kps: KPt[]; area: number }[] = [];
    for (let p = 0; p < 6; p++) {
      const base = p * 56;
      if (out[base + 55] < BOX_SCORE) continue;
      const kps: KPt[] = [];
      for (let j = 0; j < 17; j++) {
        kps.push({ y: out[base + j * 3] * h, x: (1 - out[base + j * 3 + 1]) * w, score: out[base + j * 3 + 2] });
      }
      const head = [KP.nose, KP.leftEye, KP.rightEye].map(i => kps[i]).filter(kp => kp.score >= 0.2);
      const cx = head.length ? head.reduce((a, kp) => a + kp.x, 0) / head.length : (1 - (out[base + 52] + out[base + 54]) / 2) * w;
      const cy = head.length ? head.reduce((a, kp) => a + kp.y, 0) / head.length : ((out[base + 51] + out[base + 53]) / 2) * h;
      const area = Math.abs((out[base + 53] - out[base + 51]) * (out[base + 54] - out[base + 52]));
      dets.push({ cx, cy, kps, area });
    }

    // 2. Global closest-pair assignment + EMA smoothing + persistence.
    const gate = 0.22 * maxDim;
    const prev = tracks.current;
    const pairs: { i: number; k: number; d: number }[] = [];
    for (let i = 0; i < prev.length; i++) {
      for (let kk = 0; kk < dets.length; kk++) {
        const d = Math.hypot(prev[i].cx - dets[kk].cx, prev[i].cy - dets[kk].cy);
        if (d < gate) pairs.push({ i, k: kk, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    const tUsed = new Set<number>(), dUsed = new Set<number>();
    const matchOf = new Array(dets.length).fill(-1);
    for (const pr of pairs) {
      if (tUsed.has(pr.i) || dUsed.has(pr.k)) continue;
      tUsed.add(pr.i); dUsed.add(pr.k); matchOf[pr.k] = pr.i;
    }
    const next: Track[] = [];
    for (let kk = 0; kk < dets.length; kk++) {
      const d = dets[kk];
      if (matchOf[kk] >= 0) {
        const t = prev[matchOf[kk]];
        const kps = d.kps.map((kp, j) => {
          const pk = t.kps[j];
          if (!pk) return kp;
          if (kp.score < KP_SCORE) return pk;
          return { x: EMA * kp.x + (1 - EMA) * pk.x, y: EMA * kp.y + (1 - EMA) * pk.y, score: kp.score };
        });
        next.push({ id: t.id, cx: EMA * d.cx + (1 - EMA) * t.cx, cy: EMA * d.cy + (1 - EMA) * t.cy, kps, score: 1, area: d.area, missed: 0 });
      } else {
        next.push({ id: nextId.current++, cx: d.cx, cy: d.cy, kps: d.kps, score: 1, area: d.area, missed: 0 });
      }
    }
    for (let i = 0; i < prev.length; i++) {
      if (!tUsed.has(i) && prev[i].missed < MAX_MISSED) next.push({ ...prev[i], missed: prev[i].missed + 1 });
    }
    tracks.current = next;

    // 3. HARD trainee lock — never auto-switches to the other person; only a tap does.
    const anchor = primaryAnchor.current;
    if (tap.current && next.length) {
      const tp = tap.current; tap.current = null;
      let bd = Infinity, sel: Track | undefined;
      for (const t of next) { const d = Math.hypot(t.cx - tp.x, t.cy - tp.y); if (d < bd) { bd = d; sel = t; } }
      if (sel) { primaryId.current = sel.id; primaryAnchor.current = { x: sel.cx, y: sel.cy }; }
    }
    const decided = primaryId.current !== -1;
    let primary = next.find(t => t.id === primaryId.current);
    if (primary && anchor && Math.hypot(primary.cx - anchor.x, primary.cy - anchor.y) > 0.2 * maxDim) primary = undefined;
    if (!primary && decided && anchor) {
      let bd = 0.15 * maxDim;
      for (const t of next) { const d = Math.hypot(t.cx - anchor.x, t.cy - anchor.y); if (d < bd) { bd = d; primary = t; } }
    }
    if (!primary && !decided && next.length) primary = next.reduce((a, b) => (b.area > a.area ? b : a));
    if (primary) { primaryId.current = primary.id; primaryAnchor.current = { x: primary.cx, y: primary.cy }; }
    const ptid = primary ? primary.id : -999;

    // 4. Trainee rep gesture + assistance (others' hands near the trainee's arm).
    let g: MultiGesture = { atEffort: false, atRest: false, angle: null, assisted: false };
    const angleList: Angle[] = [];
    if (primary) {
      const tk = primary.kps;
      const base = gesture(tk, def, side, effort, rest, floor);
      const others = next.filter(t => t.id !== ptid).map(t => t.kps);
      const assisted = isAssisted(tk, others, assistTargets(side), floor, assistRatio)
        || isSelfAssisted(tk, side, floor, assistRatio);
      g = { ...base, assisted };
      for (const [a, v, c] of activeTriplets) {
        if (tk[a].score >= floor && tk[v].score >= floor && tk[c].score >= floor) {
          angleList.push({ x: tk[v].x, y: tk[v].y, deg: angleAt(tk[a], tk[v], tk[c]) });
        }
      }
    }
    onFrame(g);
    setAssistedNow(g.assisted);
    setAngles(angleList);
    setPersons(next.map(t => ({ kps: t.kps, color: t.id === ptid ? '#333333' : '#8a9bb0', primary: t.id === ptid })));
  }, [def, side, effort, rest, floor, assistRatio, onFrame]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame: useCallback((frame: any) => {
      'worklet';
      try {
        const img = HybridFrameConverter.convertFrameToImage(frame).resize(W, H);
        const raw = img.toRawPixelData();
        const src = new Uint8Array(raw.buffer);
        const bgra = raw.pixelFormat === 'BGRA';
        const n = W * H * 3;
        const rgb: any = dtype === 'int32' ? new Int32Array(n) : dtype === 'float32' ? new Float32Array(n) : new Uint8Array(n);
        for (let pi = 0, o = 0; o < n; pi += 4, o += 3) {
          if (bgra) { rgb[o] = src[pi + 2]; rgb[o + 1] = src[pi + 1]; rgb[o + 2] = src[pi]; }
          else { rgb[o] = src[pi]; rgb[o + 1] = src[pi + 1]; rgb[o + 2] = src[pi + 2]; }
        }
        const r = model.runSync([rgb.buffer]);
        runOnJS(report)(Array.from(new Float32Array(r[0])));
      } catch (e) {
      } finally {
        frame.dispose();
      }
    }, [model, report, W, H, dtype]),
  });

  const onLayout = (e: LayoutChangeEvent) => {
    dims.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };
  const cameraEl = React.useMemo(
    () => (
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        video
        outputs={[frameOutput]}
      />
    ),
    [device, isActive, frameOutput],
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onResponderRelease={e => { tap.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; }}>
      {cameraEl}

      {persons.map((person, pi) => (
        <View key={pi} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: person.primary ? 1 : 0.3 }]}>
          {EDGES.map(([a, b], i) =>
            person.kps[a].score >= KP_SCORE && person.kps[b].score >= KP_SCORE
              ? <Bone key={`e${i}`} a={person.kps[a]} b={person.kps[b]} color={person.color} />
              : null)}
          {person.kps.map((kp, i) => kp.score < KP_SCORE ? null : (
            <View key={`j${i}`} style={[s.dot, { left: kp.x, top: kp.y, backgroundColor: person.color }]} />
          ))}
          {person.primary && person.kps[KP.nose].score >= KP_SCORE && (
            <View style={[s.tag, { left: person.kps[KP.nose].x - 24, top: person.kps[KP.nose].y - 42 }]}>
              <Text style={s.tagText}>TRAINEE</Text>
            </View>
          )}
        </View>
      ))}

      {angles.map((a, i) => (
        <View key={`a${i}`} pointerEvents="none" style={[s.angleTag, { left: a.x + 10, top: a.y - 12 }]}>
          <Text style={s.angleText}>{Math.round(a.deg)}°</Text>
        </View>
      ))}

      {assistedNow && (
        <View pointerEvents="none" style={s.assistBanner}><Text style={s.assistText}>ASSISTED</Text></View>
      )}
    </View>
  );
});

function Bone({ a, b, color }: { a: KPt; b: KPt; color: string }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return <View pointerEvents="none" style={{
    position: 'absolute', left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1.5,
    width: len, height: 3, borderRadius: 2, backgroundColor: color, transform: [{ rotateZ: `${deg}deg` }],
  }} />;
}

const Center = ({ children }: any) => <View style={s.center}>{children}</View>;
const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 24 },
  txt: { color: 'rgba(51,51,51,0.55)', fontSize: 15, textAlign: 'center' },
  dot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, marginLeft: -4.5, marginTop: -4.5, borderWidth: 1, borderColor: '#fff' },
  tag: { position: 'absolute', backgroundColor: '#e0e7ef', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { color: '#333333', fontSize: 12, fontWeight: '600' },
  angleTag: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  angleText: { color: '#333333', fontSize: 16, fontWeight: '600' },
  assistBanner: { position: 'absolute', top: 120, alignSelf: 'center', backgroundColor: '#e0e7ef', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  assistText: { color: '#333333', fontSize: 15, fontWeight: '600', letterSpacing: 1 },
});
