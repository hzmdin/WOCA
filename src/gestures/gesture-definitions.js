// What each raw gesture measures. activation(signals, calibration) returns how
// far the user has moved toward the gesture as a fraction of their calibrated range:
// 0 = their resting value, 1 = their typical full effort. Pure functions.

// MediaPipe's "Left"/"Right" blendshape names may refer to the image side rather
// than the user's side. Verified on the developer's camera: false is correct.
const EYE_SIDE_SWAP = false;

const avg = (a, b) => ((a ?? 0) + (b ?? 0)) / 2;

function eyesToward(b, side) {
  // Looking to one side: that side's eye looks OUT, the other eye looks IN.
  const left = avg(b.eyeLookOutLeft, b.eyeLookInRight);
  const right = avg(b.eyeLookOutRight, b.eyeLookInLeft);
  const wantLeft = (side === 'left') !== EYE_SIDE_SWAP;
  return wantLeft ? left : right;
}

/**
 * The raw number behind each calibrated range ("range key"). Bigger = more of
 * that movement. Degrees for head keys, 0..1 blendshape scores for the rest.
 */
export const MEASURES = Object.freeze({
  headLeft: (s) => s.yaw,
  headRight: (s) => -s.yaw,
  headUp: (s) => s.pitch,
  headDown: (s) => -s.pitch,
  eyesLeft: (s) => eyesToward(s.blendshapes, 'left'),
  eyesRight: (s) => eyesToward(s.blendshapes, 'right'),
  eyesUp: (s) => avg(s.blendshapes.eyeLookUpLeft, s.blendshapes.eyeLookUpRight),
  eyesDown: (s) => avg(s.blendshapes.eyeLookDownLeft, s.blendshapes.eyeLookDownRight),
  eyesClosed: (s) => avg(s.blendshapes.eyeBlinkLeft, s.blendshapes.eyeBlinkRight),
  smile: (s) => avg(s.blendshapes.mouthSmileLeft, s.blendshapes.mouthSmileRight),
  // Raised eyebrows: the middle and both outer parts together, so one twitching brow doesn't count.
  browUp: (s) =>
    (((s.blendshapes.browInnerUp ?? 0) + avg(s.blendshapes.browOuterUpLeft, s.blendshapes.browOuterUpRight)) / 2),
  mouthOpen: (s) => s.blendshapes.jawOpen ?? 0,
});

export const HEAD_KEYS = Object.freeze(['headLeft', 'headRight', 'headUp', 'headDown']);

/** The user's resting value of a measure: head keys from `neutral`, others from `baseline`. */
export function restValue(key, c) {
  switch (key) {
    case 'headLeft': return c.neutral.yaw;
    case 'headRight': return -c.neutral.yaw;
    case 'headUp': return c.neutral.pitch;
    case 'headDown': return -c.neutral.pitch;
    default: return c.baseline?.[key] ?? 0;
  }
}

/** (measure − rest) ÷ range, never negative. */
export function activationFor(key, s, c) {
  const range = c.ranges[key];
  if (!(range > 0)) return 0;
  return Math.max(0, (MEASURES[key](s) - restValue(key, c)) / range);
}

const hold = (rangeKey, extra = {}) => ({
  kind: 'hold',
  rangeKey,
  activation: (s, c) => activationFor(rangeKey, s, c),
  ...extra,
});

/** Eye-direction gesture: ignored while the head is turned (see eyeGestureMaxHeadPct). */
const eyeHold = (rangeKey) => hold(rangeKey, { eyeDirection: true });

/**
 * kind 'hold':    fires once activation has been held for holdMs.
 * kind 'release': fires when released after being held between minMs and maxMs.
 *                 Used for longBlink so that a longer close (pause) doesn't also select.
 * rangeKey:       which calibrated range (and calibration step) the gesture uses.
 * eyeDirection:   only counts while the head is still (engine checks this).
 * thresholdPct:   own start threshold instead of settings.thresholdPct.
 */
export const GESTURES = Object.freeze({
  headLeft: hold('headLeft'),
  headRight: hold('headRight'),
  headUp: hold('headUp'),
  headDown: hold('headDown'),
  eyesLeft: eyeHold('eyesLeft'),
  eyesRight: eyeHold('eyesRight'),
  eyesUp: eyeHold('eyesUp'),
  eyesDown: eyeHold('eyesDown'),
  longBlink: {
    kind: 'release',
    rangeKey: 'eyesClosed',
    thresholdPct: (settings) => settings.closedThresholdPct,
    minMs: (settings) => settings.longBlinkMs,
    maxMs: (settings) => settings.pauseHoldMs,
    activation: (s, c) => activationFor('eyesClosed', s, c),
  },
  eyesClosed3s: hold('eyesClosed', {
    holdMs: (settings) => settings.pauseHoldMs,
    thresholdPct: (settings) => settings.closedThresholdPct,
  }),
  smile: hold('smile'),
  browUp: hold('browUp'),
  mouthOpen: hold('mouthOpen'),
});
