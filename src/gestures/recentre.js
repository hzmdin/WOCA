// Re-centre after the bed angle changes (task 2.6), and notice when it is
// probably needed. Pure functions.
import { MEASURES, HEAD_KEYS, activationFor } from './gesture-definitions.js';
import { percentile } from './calibration.js';

const MIN_FACE_FRACTION = 0.7;
// Eye direction shifts with head angle; blink and smile resting values don't.
const EYE_DIRECTION_KEYS = ['eyesLeft', 'eyesRight', 'eyesUp', 'eyesDown'];

/**
 * New calibration with the user's current resting head pose (and resting eye
 * direction). Ranges, blink/smile baselines and mouth guard are kept.
 * @returns {{ok: true, calibration} | {ok: false, reason: 'noFace'|'moving'}}
 */
export function recentre(calibration, frames, settings, now = new Date()) {
  const seen = frames.filter((f) => f.faceFound);
  if (!frames.length || seen.length / frames.length < MIN_FACE_FRACTION) return { ok: false, reason: 'noFace' };

  const spread = (fn) => percentile(seen.map(fn), 0.9) - percentile(seen.map(fn), 0.1);
  const { maxSpreadDeg } = settings.recentre;
  if (spread((f) => f.yaw) > maxSpreadDeg || spread((f) => f.pitch) > maxSpreadDeg) {
    return { ok: false, reason: 'moving' };
  }

  const median = (fn) => percentile(seen.map(fn), 0.5);
  const baseline = { ...calibration.baseline };
  for (const key of EYE_DIRECTION_KEYS) baseline[key] = median(MEASURES[key]);

  return {
    ok: true,
    calibration: {
      ...calibration,
      neutral: { yaw: median((f) => f.yaw), pitch: median((f) => f.pitch), roll: median((f) => f.roll) },
      baseline,
      recentredAt: now.toISOString(),
    },
  };
}

/**
 * Drift watch: if the user's head stays off its resting pose (above releasePct of a
 * range) for driftMs while no gesture fires, the bed has probably moved.
 */
export function createDriftState() {
  return { offSince: null };
}

/**
 * @param engineOut the stepEngine result for the same frame (events, guarded)
 * @returns {{ state, suggest: boolean }}
 */
export function stepDrift(state, signals, engineOut, { settings, calibration }) {
  if (!signals.faceFound || engineOut?.guarded || engineOut?.events?.length) {
    return { state: { offSince: null }, suggest: false };
  }
  const off = HEAD_KEYS.some((k) => activationFor(k, signals, calibration) >= settings.releasePct);
  if (!off) return { state: { offSince: null }, suggest: false };
  const offSince = state.offSince ?? signals.t;
  return { state: { offSince }, suggest: signals.t - offSince >= settings.recentre.driftMs };
}
