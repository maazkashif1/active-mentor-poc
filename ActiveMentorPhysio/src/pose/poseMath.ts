// Pure pose math — keypoint parsing, joint angles, per-exercise rep counting.
// No React / no native deps, so it's unit-testable (see poseMath.test.ts).

export type Keypoint = { x: number; y: number; score: number }; // normalized 0..1

// MoveNet SinglePose keypoint indices (output order).
export const KP = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
} as const;

// MoveNet output is a flat [y, x, score] * 17 (normalized 0..1).
export function parseKeypoints(out: ArrayLike<number>): Keypoint[] {
  const kps: Keypoint[] = [];
  for (let i = 0; i < 17; i++) {
    kps.push({ y: out[i * 3], x: out[i * 3 + 1], score: out[i * 3 + 2] });
  }
  return kps;
}

// Angle at vertex b formed by points a-b-c, in degrees (0..180). NaN if degenerate.
export function angleAt(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb === 0 || magCb === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

type Triplet = [number, number, number]; // [a, vertex, c] keypoint indices

export type ExerciseDef = {
  id: string;
  // Effort increases the angle (hand raise) or decreases it (squat/push-up).
  effort: 'increase' | 'decrease';
  left: Triplet;
  right: Triplet;
  // Fallback thresholds when no prescription is supplied (degrees).
  defaultEffortAngle: number; // angle to reach at the effort peak
  defaultRestAngle: number;   // angle to return to at rest
};

export const EXERCISES: Record<string, ExerciseDef> = {
  // Shoulder flexion: hip -> shoulder -> elbow. Arm down ~0-20deg, overhead ~180deg.
  hand_raise: {
    id: 'hand_raise', effort: 'increase',
    left: [KP.leftHip, KP.leftShoulder, KP.leftElbow],
    right: [KP.rightHip, KP.rightShoulder, KP.rightElbow],
    defaultEffortAngle: 90, defaultRestAngle: 30,
  },
};

export type Side = 'both' | 'left' | 'right';

// Evaluate the effort/rest gesture for this frame, per side mode.
//  - 'left'/'right': that arm's angle only (the other is ignored).
//  - 'both': BOTH arms must reach effort together, and BOTH must return to rest,
//    for one rep. The reported angle is the lagging arm so one arm can't cheat.
// Returns angle=null when the needed joints are below the confidence floor.
export function gesture(
  kps: Keypoint[], def: ExerciseDef, side: Side, effort: number, rest: number, floor: number
): { atEffort: boolean; atRest: boolean; angle: number | null } {
  const sideAngle = (t: Triplet): number => {
    const [a, b, c] = [kps[t[0]], kps[t[1]], kps[t[2]]];
    if (a.score < floor || b.score < floor || c.score < floor) return NaN;
    return angleAt(a, b, c);
  };
  const reachedEffort = (ang: number) => (def.effort === 'increase' ? ang >= effort : ang <= effort);
  const reachedRest = (ang: number) => (def.effort === 'increase' ? ang <= rest : ang >= rest);

  if (side !== 'both') {
    const a = sideAngle(side === 'left' ? def.left : def.right);
    if (isNaN(a)) return { atEffort: false, atRest: false, angle: null };
    return { atEffort: reachedEffort(a), atRest: reachedRest(a), angle: a };
  }
  const L = sideAngle(def.left), R = sideAngle(def.right);
  if (isNaN(L) || isNaN(R)) return { atEffort: false, atRest: false, angle: null };
  // Lagging arm = the one further from effort (min for increase, max for decrease).
  const angle = def.effort === 'increase' ? Math.min(L, R) : Math.max(L, R);
  return { atEffort: reachedEffort(L) && reachedEffort(R), atRest: reachedRest(L) && reachedRest(R), angle };
}

// Minimum time between counted reps — a physical rep can't complete faster.
// Backstop against any residual rapid counting. ponytail: tune if reps are fast.
export const REP_COOLDOWN_MS = 400;

export type RepState = { phase: 'rest' | 'effort'; reps: number; lastRepAt: number };
export const initialRepState: RepState = { phase: 'rest', reps: 0, lastRepAt: 0 };

// Two-gate hysteresis on the per-frame gesture: a rep counts when effort is
// reached and then rest is reached again. `now` (ms) drives the cooldown.
export function updateRep(
  state: RepState, atEffort: boolean, atRest: boolean, now = 0
): RepState {
  if (state.phase === 'rest' && atEffort) return { ...state, phase: 'effort' };
  if (state.phase === 'effort' && atRest) {
    if (now - state.lastRepAt < REP_COOLDOWN_MS) return { ...state, phase: 'rest' }; // too soon, don't count
    return { phase: 'rest', reps: state.reps + 1, lastRepAt: now };
  }
  return state;
}

// Resolve the effort/rest thresholds for a rep. Prescription overrides apply to
// 'increase' exercises (hand raise), whose raise/lower map cleanly.
export function resolveThresholds(
  def: ExerciseDef,
  prescription?: { raiseAngleThreshold?: number; lowerAngleThreshold?: number }
): { effort: number; rest: number } {
  if (def.effort === 'increase' && prescription?.raiseAngleThreshold != null) {
    return {
      effort: prescription.raiseAngleThreshold,
      rest: prescription.lowerAngleThreshold ?? def.defaultRestAngle,
    };
  }
  return { effort: def.defaultEffortAngle, rest: def.defaultRestAngle };
}

// ── Adaptive threshold (hand raise / 'increase' exercises) ───────────────────
// Angle definition: angleAt(hip, SHOULDER, elbow).
//   0°  = arm hanging (elbow & hip both below shoulder, vectors near-parallel).
//   90° = arm at shoulder level (elbow horizontal from shoulder).
//  180° = arm straight overhead.
// Default: effort=90°, rest=30°.
//
// Attempt detection: arm rises above `attemptThreshold` (rest+5°).
// Using rest+5° (not the previous rest+15°) so low-range patients (max ~35–45°)
// register attempts and can trigger adaptation. A fixed threshold at rest+5° is
// more predictable than direction-tracking (direction needs delta state, misfires
// on jitter even with EMA). Keypoint-level EMA in MultiPoseCamera reduces noise
// enough that rest+5° is stable.
//
// Downward: if N consecutive failed attempts plateau within `tolerance`°, and the
// plateau is >= physio-set `minAdaptedAngle`, adapt down to the mean plateau.
// Upward: if N consecutive successful reps all have peaks above the adapted target
// by more than `tolerance`°, adapt back up (never above original target).

export type AdaptiveConfig = {
  consistentAttempts: number; // streak length for adaptation (default 3)
  tolerance: number;          // max spread of plateau peaks, degrees (default 5)
};
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = { consistentAttempts: 3, tolerance: 5 };

export type AdaptationEvent = {
  timestamp: number;      // ms since epoch
  from: number;           // previous target (degrees)
  to: number;             // new target (degrees)
  reason: 'down' | 'up';
};

export type AdaptiveState = {
  peakThisAttempt: number;         // max angle (keypoint-EMA) since arm left rest zone
  attempted: boolean;              // arm has risen above attemptThreshold this cycle
  attemptStartMs: number;          // ms timestamp of first threshold crossing; -1 = not set
  recentFailedPeaks: number[];     // peaks of recent failed attempts
  recentSuccessPeaks: number[];    // peaks of recent successful reps (for upward adaptation)
  adaptedTarget: number | null;    // null = still using original target
  adaptationEvents: AdaptationEvent[];
};
export const initialAdaptiveState: AdaptiveState = {
  peakThisAttempt: 0, attempted: false, attemptStartMs: -1,
  recentFailedPeaks: [], recentSuccessPeaks: [],
  adaptedTarget: null, adaptationEvents: [],
};

/**
 * Update adaptive state once per frame (after updateRep).
 * Only call for 'increase' exercises (hand raise).
 * Pass `g.angle` (keypoint-level EMA, not double-smoothed) so peak tracking
 * isn't shaved by the display-smoothing layer.
 *
 * @param state            current adaptive state
 * @param angle            keypoint-level EMA angle this frame (pass g.angle)
 * @param repJustCounted   true when updateRep just incremented reps this frame
 * @param atRestNow        gesture().atRest for this frame
 * @param originalTarget   effort threshold from prescription (or default 90°)
 * @param minAdaptedAngle  physio-set floor; adapted target never below this
 *                         (default rest+10°; if plateau is below floor, record
 *                          peaks but don't adapt)
 * @param attemptThreshold arm above this = "trying" (use rest+5°)
 * @param config           { consistentAttempts:3, tolerance:5 }
 * @param now              current time in ms (Date.now()); defaults to 0 for tests
 */
export function updateAdaptive(
  state: AdaptiveState,
  angle: number,
  repJustCounted: boolean,
  atRestNow: boolean,
  originalTarget: number,
  minAdaptedAngle: number,
  attemptThreshold: number,
  config: AdaptiveConfig,
  now = 0,
): AdaptiveState {
  const attempting = angle >= attemptThreshold;
  const firstCross = !state.attempted && attempting;

  let next: AdaptiveState = {
    ...state,
    attempted: state.attempted || attempting,
    peakThisAttempt: (state.attempted || attempting)
      ? Math.max(state.peakThisAttempt, angle)
      : state.peakThisAttempt,
    // Record timestamp only on the FIRST crossing — preserved through mid-rise dips
    attemptStartMs: firstCross ? now : state.attemptStartMs,
  };

  if (!(atRestNow && next.attempted)) return next;

  // ── Arm just returned to rest — process the completed attempt ──────────────
  const peak = next.peakThisAttempt;
  const currentTarget = next.adaptedTarget ?? originalTarget;
  const reset = { peakThisAttempt: 0, attempted: false, attemptStartMs: -1 };

  if (repJustCounted) {
    // ── Successful rep ──────────────────────────────────────────────────────
    const successPeaks = next.adaptedTarget != null
      ? [...next.recentSuccessPeaks, peak].slice(-config.consistentAttempts)
      : [];
    let { adaptedTarget, adaptationEvents } = next;
    if (adaptedTarget != null && successPeaks.length >= config.consistentAttempts) {
      const lo = Math.min(...successPeaks);
      const mean = +(successPeaks.reduce((a, b) => a + b, 0) / successPeaks.length).toFixed(1);
      if (lo > adaptedTarget + config.tolerance && mean < originalTarget) {
        const newTarget = +Math.min(mean, originalTarget).toFixed(1);
        adaptationEvents = [...adaptationEvents, { timestamp: Date.now(), from: adaptedTarget, to: newTarget, reason: 'up' as const }];
        adaptedTarget = newTarget;
        return { ...next, ...reset, recentFailedPeaks: [], recentSuccessPeaks: [], adaptedTarget, adaptationEvents };
      }
    }
    return { ...next, ...reset, recentFailedPeaks: [], recentSuccessPeaks: successPeaks, adaptedTarget, adaptationEvents };
  }

  // ── Failed attempt ─────────────────────────────────────────────────────────
  // Jitter filter: only record if arm was clearly above rest (peak > attemptThreshold+5,
  // i.e. rest+10°) OR held above threshold for ≥300ms. Prevents rest-position sway from
  // polluting the failed-peak buffer.
  const duration = next.attemptStartMs >= 0 ? now - next.attemptStartMs : 0;
  const meaningfulPeak = peak > attemptThreshold + 5; // peak > rest + 10°
  const realAttempt = meaningfulPeak || duration >= 300;

  const peaks = realAttempt
    ? [...next.recentFailedPeaks, peak].slice(-config.consistentAttempts)
    : next.recentFailedPeaks;

  let { adaptedTarget, adaptationEvents } = next;

  if (realAttempt && peaks.length >= config.consistentAttempts) {
    const lo = Math.min(...peaks), hi = Math.max(...peaks);
    const mean = +(peaks.reduce((a, b) => a + b, 0) / peaks.length).toFixed(1);
    if (
      hi - lo <= config.tolerance &&
      hi < currentTarget - config.tolerance &&
      lo >= minAdaptedAngle
    ) {
      adaptationEvents = [...adaptationEvents, { timestamp: Date.now(), from: currentTarget, to: +mean, reason: 'down' as const }];
      adaptedTarget = +mean;
      return { ...next, ...reset, recentFailedPeaks: peaks, recentSuccessPeaks: [], adaptedTarget, adaptationEvents };
    }
  }

  return { ...next, ...reset, recentFailedPeaks: peaks };
}

/**
 * Validate a persisted adapted target before restoring it at session start.
 * Returns the saved value if it falls within the current prescription's valid range,
 * null otherwise (clears back to original target).
 *
 * Rejects when:
 *  - no saved value
 *  - saved >= originalEffort  (patient recovered; start fresh at original)
 *  - saved < minAdaptedAngle  (physio raised the floor since last session)
 */
export function validateSavedTarget(
  saved: number | null | undefined,
  originalEffort: number,
  minAdaptedAngle: number,
): number | null {
  if (saved == null || saved <= 0) return null;
  if (saved >= originalEffort) return null;
  if (saved < minAdaptedAngle) return null;
  return saved;
}

// Keypoints a physio would hold while guiding the active arm(s): wrist + elbow.
export function assistTargets(side: Side): number[] {
  const left = [KP.leftWrist, KP.leftElbow];
  const right = [KP.rightWrist, KP.rightElbow];
  return side === 'left' ? left : side === 'right' ? right : [...left, ...right];
}

// True if the opposite wrist is within `ratio` shoulder-widths of the exercise
// arm's elbow or wrist — catches same-body self-assistance (left hand helping
// right arm raise). Returns false for 'both' since there's no "other" arm.
export function isSelfAssisted(
  trainee: Keypoint[], side: Side, floor: number, ratio: number,
): boolean {
  if (side === 'both') return false;
  const ls = trainee[KP.leftShoulder], rs = trainee[KP.rightShoulder];
  if (ls.score < floor || rs.score < floor) return false;
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (shoulderW <= 0) return false;
  const tol = ratio * shoulderW;
  const helperWrist = trainee[side === 'right' ? KP.leftWrist : KP.rightWrist];
  if (!helperWrist || helperWrist.score < floor) return false;
  const exerciseJoints = side === 'right'
    ? [KP.rightWrist, KP.rightElbow]
    : [KP.leftWrist, KP.leftElbow];
  for (const ti of exerciseJoints) {
    const tp = trainee[ti];
    if (!tp || tp.score < floor) continue;
    if (Math.hypot(helperWrist.x - tp.x, helperWrist.y - tp.y) < tol) return true;
  }
  return false;
}

// True if any OTHER person's wrist is within `ratio` shoulder-widths of one of
// the trainee's target joints — i.e. a hand guiding the arm (assistance).
// Normalizing by shoulder width makes the threshold camera-distance-independent.
export function isAssisted(
  trainee: Keypoint[], others: Keypoint[][], targets: number[], floor: number, ratio: number
): boolean {
  const ls = trainee[KP.leftShoulder], rs = trainee[KP.rightShoulder];
  if (ls.score < floor || rs.score < floor) return false;
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (shoulderW <= 0) return false;
  const tol = ratio * shoulderW;
  for (const o of others) {
    for (const wi of [KP.leftWrist, KP.rightWrist]) {
      const ow = o[wi];
      if (!ow || ow.score < floor) continue;
      for (const ti of targets) {
        const tp = trainee[ti];
        if (tp.score < floor) continue;
        if (Math.hypot(ow.x - tp.x, ow.y - tp.y) < tol) return true;
      }
    }
  }
  return false;
}
