// Saves the user's calibration in localStorage so it survives page reloads.
// Anything missing or invalid falls back to DEFAULT_CALIBRATION, never a crash.
import { DEFAULT_CALIBRATION } from './default-settings.js';

export const STORAGE_KEY = 'woca.calibration';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Gestures added after calibrations were first saved. An older saved calibration has no
// range for them; it stays valid and gets the default (see normalizeCalibration).
const LATER_RANGE_KEYS = Object.freeze(['browUp', 'mouthOpen']);

/** Basic shape check so a corrupted entry can't break the gesture engine. */
export function isValidCalibration(c) {
  const rangeOk = (k) => (LATER_RANGE_KEYS.includes(k) && c.ranges?.[k] === undefined) || (isNum(c.ranges?.[k]) && c.ranges[k] > 0);
  return (
    c?.version === 2 &&
    ['yaw', 'pitch', 'roll'].every((k) => isNum(c.neutral?.[k])) &&
    Object.keys(DEFAULT_CALIBRATION.ranges).every(rangeOk) &&
    typeof c.baseline === 'object' &&
    (c.guard === null || (isNum(c.guard?.smile) && isNum(c.guard?.jawOpen)))
  );
}

/** A valid calibration with any missing (later-added) gesture range or resting value filled from the defaults. */
export function normalizeCalibration(c) {
  return {
    ...c,
    ranges: { ...DEFAULT_CALIBRATION.ranges, ...c.ranges },
    baseline: { ...DEFAULT_CALIBRATION.baseline, ...c.baseline },
  };
}

export function loadCalibration(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return isValidCalibration(parsed) ? normalizeCalibration(parsed) : DEFAULT_CALIBRATION;
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

/** @returns true if saved */
export function saveCalibration(calibration, storage = globalThis.localStorage) {
  if (!isValidCalibration(calibration)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(calibration));
    return true;
  } catch {
    return false;
  }
}

export function clearCalibration(storage = globalThis.localStorage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
