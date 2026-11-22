// Calibration maths: turn recorded FaceSignals frames from the wizard steps
// into the user's own calibration (resting pose, ranges, guard thresholds).
// Pure: no DOM, no storage. The wizard UI collects frames and calls these.
import { GESTURES, MEASURES, HEAD_KEYS, restValue } from './gesture-definitions.js';
import { createEngineState, stepEngine } from './gesture-engine.js';

const MIN_FACE_FRACTION = 0.7; // a step with less face visible than this fails

/** Value at fraction p (0..1) of the sorted values. */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
}

/** Steps for a gesture map: 'rest' first, then each range key the mapped gestures use, once. */
export function calibrationSteps(gestureMap) {
  const used = new Set(
    Object.values(gestureMap)
      .filter((g) => g && GESTURES[g])
      .map((g) => GESTURES[g].rangeKey)
  );
  return ['rest', ...Object.keys(MEASURES).filter((k) => used.has(k))];
}

/**
 * Peak value of each repetition: a rep starts when values rise above `high`
 * and ends when they fall back below `low`.
 */
export function repPeaks(values, high, low) {
  const peaks = [];
  let current = null;
  for (const v of values) {
    if (current === null) {
      if (v >= high) current = v;
    } else if (v < low) {
      peaks.push(current);
      current = null;
    } else {
      current = Math.max(current, v);
    }
  }
  if (current !== null) peaks.push(current); // rep still going when the step ended
  return peaks;
}

/** The gesture whose detection we test for a range key (prefers the one in the map). */
export function gestureForKey(key, gestureMap) {
  const mapped = Object.values(gestureMap).filter((g) => g && GESTURES[g]?.rangeKey === key);
  const pool = mapped.length ? mapped : Object.keys(GESTURES).filter((g) => GESTURES[g].rangeKey === key);
  // eyesClosed: test longBlink (1s) rather than the 3s pause hold when both exist.
  return pool.find((g) => GESTURES[g].kind === 'release') ?? pool[0];
}

/** How many times the real engine would detect `gesture` in these frames. */
function countDetections(frames, gesture, calibration, settings) {
  const cfg = { settings: { ...settings, gestureMap: { TEST: gesture } }, calibration };
  let state = createEngineState(cfg.settings.gestureMap);
  let n = 0;
  for (const f of frames) {
    const out = stepEngine(state, f, cfg);
    state = out.state;
    n += out.events.length;
  }
  return n;
}

const faceFrames = (frames) => frames.filter((f) => f.faceFound);

/**
 * Rest step: resting head pose, resting eye/face values, and guard thresholds
 * placed above the user's resting mouth.
 * @returns {{ok: true, neutral, baseline, guard} | {ok: false, reason: 'noFace'}}
 */
export function analyzeRest(frames, settings) {
  const seen = faceFrames(frames);
  if (!frames.length || seen.length / frames.length < MIN_FACE_FRACTION) return { ok: false, reason: 'noFace' };

  const median = (fn) => percentile(seen.map(fn), 0.5);
  const neutral = { yaw: median((f) => f.yaw), pitch: median((f) => f.pitch), roll: median((f) => f.roll) };

  const baseline = {};
  for (const key of Object.keys(MEASURES)) {
    if (!HEAD_KEYS.includes(key)) baseline[key] = median(MEASURES[key]);
  }

  const { guardMargin } = settings.calibration;
  const defaults = settings.expressionGuard;
  const restSmile = percentile(seen.map(MEASURES.smile), 0.95);
  const restJaw = percentile(seen.map((f) => f.blendshapes.jawOpen ?? 0), 0.95);
  const guard = {
    smile: Math.max(defaults.smile, restSmile + guardMargin.smile),
    jawOpen: Math.max(defaults.jawOpen, restJaw + guardMargin.jawOpen),
  };

  return { ok: true, neutral, baseline, guard };
}

/**
 * Gesture step: the user's typical full-effort range for one range key.
 * range = median of the repetition peaks, so one extra-big (or tiny) rep
 * doesn't skew it. Then the step is replayed through the real engine with the
 * new range: `reps` = how many times WOCA would actually have detected it.
 * @returns {{ok, range, reps, reason?: 'noFace'|'tooSmall'|'notDetected'}}
 */
export function analyzeGesture(key, frames, rest, settings, gesture = gestureForKey(key, settings.gestureMap)) {
  const seen = faceFrames(frames);
  if (!frames.length || seen.length / frames.length < MIN_FACE_FRACTION) {
    return { ok: false, reason: 'noFace', range: 0, reps: 0 };
  }
  const restCal = { neutral: rest.neutral, baseline: rest.baseline };
  const disp = seen.map((f) => MEASURES[key](f) - restValue(key, restCal));
  const { minRange, minReps } = settings.calibration;
  const min = HEAD_KEYS.includes(key) ? minRange.head : minRange.score;

  // Split into repetitions with a low bar (30% of the biggest movement, never
  // below the minimum) so normal reps still count next to one extra-big rep.
  const p95 = percentile(disp, 0.95);
  const high = Math.max(min, p95 * 0.3);
  const peaks = repPeaks(disp, high, high / 2);
  const range = peaks.length ? percentile(peaks, 0.5) : p95;
  if (range < min) return { ok: false, reason: 'tooSmall', range, reps: 0 };

  const trial = { ...restCal, guard: rest.guard, ranges: { [key]: range } };
  const reps = countDetections(frames, gesture, trial, settings);
  if (reps < minReps) return { ok: false, reason: 'notDetected', range, reps };
  return { ok: true, range, reps };
}

/**
 * Combine results into a calibration object. Skipped/failed gestures keep the
 * previous range, so a partial calibration never makes things worse.
 * @param results { [rangeKey]: analyzeGesture result | undefined }
 */
export function buildCalibration(rest, results, previous, now = new Date()) {
  const ranges = { ...previous.ranges };
  for (const [key, r] of Object.entries(results)) if (r?.ok) ranges[key] = r.range;
  return {
    version: 2,
    neutral: rest.neutral,
    baseline: { ...previous.baseline, ...rest.baseline },
    guard: rest.guard,
    ranges,
    createdAt: now.toISOString(),
  };
}
