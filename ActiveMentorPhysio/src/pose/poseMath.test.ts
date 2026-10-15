import {
  parseKeypoints, angleAt, gesture, updateRep, resolveThresholds,
  initialRepState, EXERCISES, KP, Keypoint, isAssisted, assistTargets,
  updateAdaptive, initialAdaptiveState, DEFAULT_ADAPTIVE_CONFIG, AdaptiveState,
  validateSavedTarget,
} from './poseMath';

const k = (x: number, y: number, score = 1): Keypoint => ({ x, y, score });
const body = (overrides: Record<number, Keypoint>): Keypoint[] => {
  const base = Array.from({ length: 17 }, () => k(0, 0, 1));
  for (const [i, v] of Object.entries(overrides)) base[+i] = v;
  return base;
};
// Like body() but unset joints have score 0 (ignored by the confidence floor).
const sparse = (overrides: Record<number, Keypoint>): Keypoint[] => {
  const base = Array.from({ length: 17 }, () => k(0, 0, 0));
  for (const [i, v] of Object.entries(overrides)) base[+i] = v;
  return base;
};
// Shoulder angle ~180 (arm overhead): hip below, elbow above the shoulder.
const raised = (hip: number, sh: number, el: number) => ({
  [hip]: k(0.5, 0.7), [sh]: k(0.5, 0.4), [el]: k(0.5, 0.1),
});
// Shoulder angle ~0 (arm hanging): hip and elbow both below the shoulder.
const down = (hip: number, sh: number, el: number) => ({
  [hip]: k(0.5, 0.7), [sh]: k(0.5, 0.4), [el]: k(0.5, 0.5),
});
const HR = EXERCISES.hand_raise;

describe('angleAt', () => {
  it('is 90deg for a right angle', () => expect(angleAt(k(1, 0), k(0, 0), k(0, 1))).toBeCloseTo(90, 5));
  it('is 180deg for a straight line', () => expect(angleAt(k(-1, 0), k(0, 0), k(1, 0))).toBeCloseTo(180, 5));
});

describe('parseKeypoints', () => {
  it('maps flat [y,x,score]*17 into keypoints', () => {
    const out = new Array(51).fill(0);
    out[KP.nose * 3] = 0.4; out[KP.nose * 3 + 1] = 0.6; out[KP.nose * 3 + 2] = 0.9;
    expect(parseKeypoints(out)[KP.nose]).toEqual({ y: 0.4, x: 0.6, score: 0.9 });
  });
});

describe('gesture — side segregation (hand raise)', () => {
  const leftUpRightDown = body({
    ...raised(KP.leftHip, KP.leftShoulder, KP.leftElbow),
    ...down(KP.rightHip, KP.rightShoulder, KP.rightElbow),
  });
  const bothUp = body({
    ...raised(KP.leftHip, KP.leftShoulder, KP.leftElbow),
    ...raised(KP.rightHip, KP.rightShoulder, KP.rightElbow),
  });

  it('left mode counts the left arm, ignores the right', () => {
    expect(gesture(leftUpRightDown, HR, 'left', 90, 30, 0.3).atEffort).toBe(true);
  });
  it('right mode ignores a raised left arm', () => {
    const g = gesture(leftUpRightDown, HR, 'right', 90, 30, 0.3);
    expect(g.atEffort).toBe(false);
    expect(g.atRest).toBe(true); // right arm is down -> at rest
  });
  it('both mode is NOT effort when only one arm is raised', () => {
    expect(gesture(leftUpRightDown, HR, 'both', 90, 30, 0.3).atEffort).toBe(false);
  });
  it('both mode IS effort when both arms are raised', () => {
    expect(gesture(bothUp, HR, 'both', 90, 30, 0.3).atEffort).toBe(true);
  });
  it('returns null angle when joints are below the confidence floor', () => {
    const low = parseKeypoints(new Array(51).fill(0.1));
    expect(gesture(low, HR, 'both', 90, 30, 0.3).angle).toBeNull();
  });
});

describe('resolveThresholds', () => {
  it('prescription raiseAngleThreshold becomes the effort target (A4)', () => {
    expect(resolveThresholds(HR, { raiseAngleThreshold: 45, lowerAngleThreshold: 30 }))
      .toEqual({ effort: 45, rest: 30 });
  });
  it('falls back to exercise defaults when no prescription supplied (A4)', () => {
    expect(resolveThresholds(HR)).toEqual({ effort: 90, rest: 30 });
  });
});

describe('updateRep hysteresis + cooldown', () => {
  it('counts one rep per effort->rest cycle', () => {
    let s = initialRepState;
    s = updateRep(s, false, true, 1000);  // at rest
    expect(s.reps).toBe(0);
    s = updateRep(s, true, false, 1100);  // effort
    expect(s.phase).toBe('effort');
    s = updateRep(s, false, false, 1200); // between gates
    expect(s.reps).toBe(0);
    s = updateRep(s, false, true, 1300);  // back to rest -> +1
    expect(s).toMatchObject({ phase: 'rest', reps: 1 });
  });

  it('cooldown blocks a too-fast second rep', () => {
    let s = initialRepState;
    s = updateRep(s, true, false, 1000);
    s = updateRep(s, false, true, 1100); // > 400ms since 0 -> rep 1
    expect(s.reps).toBe(1);
    s = updateRep(s, true, false, 1200);
    s = updateRep(s, false, true, 1300); // 200ms since last -> blocked
    expect(s.reps).toBe(1);
    s = updateRep(s, true, false, 1600);
    s = updateRep(s, false, true, 1700); // 600ms since last -> rep 2
    expect(s.reps).toBe(2);
  });
});

describe('updateAdaptive', () => {
  // rest=30, attemptThreshold = rest+5 = 35, floor = rest+10 = 40
  const rest = 30;
  const originalTarget = 90;
  const attemptThreshold = rest + 5;  // 35 — A1 fix
  const minAdaptedAngle = rest + 10;  // 40 — A3 floor
  const cfg = DEFAULT_ADAPTIVE_CONFIG; // { consistentAttempts:3, tolerance:5 }

  // Simulate one complete failed attempt: arm rises to `peak`, holds 400ms, returns to rest.
  // startMs lets callers chain attempts at realistic timestamps.
  // The 400ms hold ensures the duration filter passes for any peak (including low-range ~35°).
  function failedAttempt(state: AdaptiveState, peak: number, floor = minAdaptedAngle, startMs = 0) {
    let s = updateAdaptive(state, peak, false, false, originalTarget, floor, attemptThreshold, cfg, startMs);
    s =     updateAdaptive(s, peak, false, false, originalTarget, floor, attemptThreshold, cfg, startMs + 400);
    return  updateAdaptive(s, rest - 5, false, true, originalTarget, floor, attemptThreshold, cfg, startMs + 500);
  }

  // Simulate one successful rep: arm rises to `peak`, rep counted, returns to rest.
  function successRep(state: AdaptiveState, peak: number, floor = minAdaptedAngle, startMs = 0) {
    let s = updateAdaptive(state, peak, false, false, originalTarget, floor, attemptThreshold, cfg, startMs);
    s =     updateAdaptive(s, peak, true, false, originalTarget, floor, attemptThreshold, cfg, startMs + 400);
    return  updateAdaptive(s, rest - 5, true, true, originalTarget, floor, attemptThreshold, cfg, startMs + 500);
  }

  // ── Existing behaviour (still expected to pass) ────────────────────────────

  it('records a failed attempt peak and does not adapt on first failure', () => {
    const s = failedAttempt(initialAdaptiveState, 65);
    expect(s.recentFailedPeaks).toEqual([65]);
    expect(s.adaptedTarget).toBeNull();
  });

  it('adapts after 3 consistent failed attempts', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64);
    s = failedAttempt(s, 66);
    s = failedAttempt(s, 65); // spread = 2 <= tolerance(5) -> adapt
    expect(s.adaptedTarget).toBeCloseTo(65, 0);
  });

  it('does NOT adapt when plateau spread exceeds tolerance', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 60);
    s = failedAttempt(s, 70); // spread = 10 > 5
    s = failedAttempt(s, 65);
    expect(s.adaptedTarget).toBeNull();
  });

  it('clears failed streak on a successful rep', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64);
    s = failedAttempt(s, 65);
    s = successRep(s, 92);
    expect(s.recentFailedPeaks).toEqual([]);
    expect(s.adaptedTarget).toBeNull();
  });

  // ── A1: low-range patients register attempts at rest+5° threshold ──────────

  it('A1: patient peaking at 35° triggers adaptation after 3 attempts (floor=rest)', () => {
    // floor=rest(30) so 35° passes the minAdaptedAngle guard
    let s = initialAdaptiveState;
    s = failedAttempt(s, 35, rest); // use floor=rest to allow 35° adaptation
    s = failedAttempt(s, 36, rest);
    s = failedAttempt(s, 35, rest); // spread=1 <= 5, mean~35.3
    expect(s.adaptedTarget).not.toBeNull();
    expect(s.adaptedTarget!).toBeCloseTo(35.3, 0);
  });

  it('A1: patient peaking at 40° triggers adaptation (above default floor=40)', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 40);
    s = failedAttempt(s, 41);
    s = failedAttempt(s, 40); // spread=1 <= 5, lo=40 >= minAdaptedAngle=40
    expect(s.adaptedTarget).not.toBeNull();
    expect(s.adaptedTarget!).toBeCloseTo(40.3, 0);
  });

  it('A1: patient peaking at 45° triggers adaptation', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 44);
    s = failedAttempt(s, 46);
    s = failedAttempt(s, 45); // spread=2 <= 5
    expect(s.adaptedTarget).not.toBeNull();
    expect(s.adaptedTarget!).toBeCloseTo(45, 0);
  });

  it('A1: attempt is NOT registered when angle is below attemptThreshold (rest+5=35)', () => {
    // An arm stuck at 34° never counts as "attempted"
    let s = updateAdaptive(initialAdaptiveState, 34, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg);
    expect(s.attempted).toBe(false);
    expect(s.peakThisAttempt).toBe(0);
  });

  // ── A3: minAdaptedAngle floor prevents adaptation below physio threshold ───

  it('A3: plateau below floor is recorded but does NOT trigger adaptation', () => {
    // minAdaptedAngle=40, patient peaks at 35 -> lo=35 < 40, no adapt
    let s = initialAdaptiveState;
    s = failedAttempt(s, 35); // floor=default=40
    s = failedAttempt(s, 36);
    s = failedAttempt(s, 35);
    expect(s.adaptedTarget).toBeNull();
    expect(s.recentFailedPeaks.length).toBe(3); // peaks still recorded
  });

  // ── A3: adaptation events are logged ──────────────────────────────────────

  it('A3: records a downward adaptation event with from/to/reason', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64);
    s = failedAttempt(s, 65);
    s = failedAttempt(s, 66);
    expect(s.adaptationEvents).toHaveLength(1);
    expect(s.adaptationEvents[0]).toMatchObject({ from: 90, reason: 'down' });
    expect(s.adaptationEvents[0].to).toBeCloseTo(65, 0);
  });

  // ── A3: upward adaptation when patient consistently overshoots ────────────

  it('A3: adapts upward when 3 consecutive success peaks all exceed adapted target + tolerance', () => {
    // First adapt down to ~65
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64);
    s = failedAttempt(s, 65);
    s = failedAttempt(s, 66); // adaptedTarget ≈ 65

    expect(s.adaptedTarget).not.toBeNull();
    const downTarget = s.adaptedTarget!;

    // Now patient has improved: peaks at 78, 80, 79 — all > 65+5=70
    s = successRep(s, 78);
    s = successRep(s, 80);
    s = successRep(s, 79); // lo=78 > 65+5=70, mean≈79, < originalTarget(90) -> up
    expect(s.adaptedTarget!).toBeGreaterThan(downTarget);
    expect(s.adaptedTarget!).toBeLessThanOrEqual(originalTarget);
    const upEvent = s.adaptationEvents.find(e => e.reason === 'up');
    expect(upEvent).toBeDefined();
    expect(upEvent!.from).toBeCloseTo(downTarget, 0);
  });

  it('A3: does NOT adapt upward when success peaks are inconsistent', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64); s = failedAttempt(s, 65); s = failedAttempt(s, 66);
    // Success peaks: one low, two high — inconsistent
    s = successRep(s, 68);  // only 68-65=3 above target, not > tolerance(5)
    s = successRep(s, 80);
    s = successRep(s, 79);
    // lo=68, adaptedTarget≈65, 68 > 65+5=70? No (68 < 70) -> no upward adaptation
    expect(s.adaptationEvents.filter(e => e.reason === 'up')).toHaveLength(0);
  });

  it('A3: upward adaptation never exceeds originalTarget', () => {
    let s = initialAdaptiveState;
    s = failedAttempt(s, 64); s = failedAttempt(s, 65); s = failedAttempt(s, 66);
    // Very high success peaks — mean would exceed originalTarget if uncapped
    s = successRep(s, 88); s = successRep(s, 89); s = successRep(s, 88);
    if (s.adaptedTarget != null) {
      expect(s.adaptedTarget).toBeLessThanOrEqual(originalTarget);
    }
  });

  // ── Jitter filter ──────────────────────────────────────────────────────────

  it('rest-position jitter for 10s produces zero entries in recentFailedPeaks', () => {
    // rest=30, attemptThreshold=35. Jitter ±6° means angle oscillates 24–36°.
    // Peak=36 < attemptThreshold+5=40 (not meaningful) and duration at 36° ≈ 1–2 frames
    // (33–66ms) < 300ms. Both filter conditions fail → no recording.
    let s = initialAdaptiveState;
    for (let i = 0; i < 300; i++) {
      const a = rest + Math.sin(i * 0.8) * 6; // 24–36°
      s = updateAdaptive(s, a, false, a <= rest, originalTarget, minAdaptedAngle, attemptThreshold, cfg, i * 33);
    }
    expect(s.recentFailedPeaks).toHaveLength(0);
  });

  // ── Hysteresis ─────────────────────────────────────────────────────────────

  it('mid-rise threshold dips do not reset attemptStartMs (single raise = single attempt)', () => {
    // Arm crosses 35° at t=100, dips to 33° (above rest, no reset), re-crosses at t=300.
    // attemptStartMs must stay at 100, not 300 — so the full duration is measured correctly.
    let s = initialAdaptiveState;

    s = updateAdaptive(s, 36, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 100);
    expect(s.attempted).toBe(true);
    expect(s.attemptStartMs).toBe(100);

    // Dip below threshold but above rest (33 > 30 → atRest=false, no processing)
    s = updateAdaptive(s, 33, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 200);
    expect(s.attempted).toBe(true);

    // Second crossing — start time must NOT reset
    s = updateAdaptive(s, 38, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 300);
    expect(s.attemptStartMs).toBe(100); // original start preserved

    // Peak continues to 65
    s = updateAdaptive(s, 65, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 400);
    expect(s.peakThisAttempt).toBeCloseTo(65, 0);

    // Return to rest: duration = 500 - 100 = 400ms ≥ 300 → realAttempt (also meaningfulPeak: 65 > 40)
    s = updateAdaptive(s, rest - 5, false, true, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 500);
    expect(s.attempted).toBe(false);
    expect(s.attemptStartMs).toBe(-1);
    expect(s.recentFailedPeaks).toContain(65);
  });

  it('jitter near threshold during a single real raise does not create multiple attempts', () => {
    // A genuine raise from rest to 60°, with threshold jitter during the ascent.
    // Multiple rest returns from jitter spikes (each too brief/shallow) should not
    // produce failed-attempt entries. The single real descent should record once.
    let s = initialAdaptiveState;

    // Short jitter spike at 36° (33ms < 300ms, peak=36 < 40) — filtered
    s = updateAdaptive(s, 36, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 0);
    s = updateAdaptive(s, 29, false, true,  originalTarget, minAdaptedAngle, attemptThreshold, cfg, 33);
    expect(s.recentFailedPeaks).toHaveLength(0); // filtered

    // Genuine raise — arm rises and stays up, then returns
    s = updateAdaptive(s, 60, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 500);
    s = updateAdaptive(s, 60, false, false, originalTarget, minAdaptedAngle, attemptThreshold, cfg, 900); // 400ms later
    s = updateAdaptive(s, 29, false, true,  originalTarget, minAdaptedAngle, attemptThreshold, cfg, 1000);
    // peak=60 > 40 → meaningful → records once
    expect(s.recentFailedPeaks).toHaveLength(1);
    expect(s.recentFailedPeaks[0]).toBeCloseTo(60, 0);
  });
});

describe('validateSavedTarget — session persistence', () => {
  const originalEffort = 90, minAdaptedAngle = 40; // rest(30)+10

  it('null saved → null', () => expect(validateSavedTarget(null, originalEffort, minAdaptedAngle)).toBeNull());
  it('undefined saved → null', () => expect(validateSavedTarget(undefined, originalEffort, minAdaptedAngle)).toBeNull());
  it('saved === originalEffort → null (patient recovered, start fresh)', () => {
    expect(validateSavedTarget(90, originalEffort, minAdaptedAngle)).toBeNull();
  });
  it('saved > originalEffort → null (stale/invalid)', () => {
    expect(validateSavedTarget(95, originalEffort, minAdaptedAngle)).toBeNull();
  });
  it('saved < minAdaptedAngle → null (physio raised the floor)', () => {
    expect(validateSavedTarget(35, originalEffort, minAdaptedAngle)).toBeNull();
  });
  it('valid saved target is restored', () => {
    expect(validateSavedTarget(45, originalEffort, minAdaptedAngle)).toBe(45);
  });
  it('saved === minAdaptedAngle is valid (boundary)', () => {
    expect(validateSavedTarget(40, originalEffort, minAdaptedAngle)).toBe(40);
  });

  it('3-session scenario: adapt down → adapt up to original → next session starts at original', () => {
    // Session 1 ends with adaptedTarget=45 → server stores currentAdaptedAngle=45
    // Session 2 starts: validateSavedTarget(45, 90, 40) = 45 ✓
    expect(validateSavedTarget(45, originalEffort, minAdaptedAngle)).toBe(45);

    // Session 2 patient improves; upward adaptation reaches originalEffort(90).
    // Server always writes currentAdaptedAngle = adaptedTargetAngle = 90.
    const afterSession2 = 90;
    // Session 3 start: 90 >= originalEffort(90) → rejected → null → starts at original
    expect(validateSavedTarget(afterSession2, originalEffort, minAdaptedAngle)).toBeNull();
  });

  it('physio raises floor: saved value that passed before now fails', () => {
    // Old floor=30, saved=35 was valid. Physio updates minAdaptedAngle to 40.
    // After PATCH /prescriptions/:id, server clears currentAdaptedAngle.
    // Client: validateSavedTarget(35, 90, 40) → null
    expect(validateSavedTarget(35, originalEffort, 40 /* new floor */)).toBeNull();
  });
});

describe('isAssisted', () => {
  const floor = 0.3, ratio = 0.6;
  // shoulders 0.2 apart -> tol = 0.6*0.2 = 0.12
  const trainee = sparse({
    [KP.leftShoulder]: k(0.4, 0.5), [KP.rightShoulder]: k(0.6, 0.5),
    [KP.leftWrist]: k(0.4, 0.2),
  });
  it('flags a hand near the trainee wrist', () => {
    const physio = sparse({ [KP.rightWrist]: k(0.44, 0.21) }); // ~0.04 away < 0.12
    expect(isAssisted(trainee, [physio], assistTargets('left'), floor, ratio)).toBe(true);
  });
  it('ignores a hand far from the trainee', () => {
    const physio = sparse({ [KP.rightWrist]: k(0.9, 0.9) });
    expect(isAssisted(trainee, [physio], assistTargets('left'), floor, ratio)).toBe(false);
  });
  it('is false when the trainee shoulders are not visible', () => {
    const noShoulders = sparse({ [KP.leftWrist]: k(0.4, 0.2) });
    const physio = sparse({ [KP.rightWrist]: k(0.4, 0.2) });
    expect(isAssisted(noShoulders, [physio], assistTargets('left'), floor, ratio)).toBe(false);
  });
});
