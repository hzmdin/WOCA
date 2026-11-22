// Saves the user's calibration in localStorage so it survives page reloads.
// Anything missing or invalid falls back to DEFAULT_CALIBRATION, never a crash.
import { DEFAULT_CALIBRATION } from './default-settings.js';

export const STORAGE_KEY = 'woca.calibration';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Basic shape check so a corrupted entry can't break the gesture engine. */
export function isValidCalibration(c) {
  return (
    c?.version === 2 &&
    ['yaw', 'pitch', 'roll'].every((k) => isNum(c.neutral?.[k])) &&
    Object.keys(DEFAULT_CALIBRATION.ranges).every((k) => isNum(c.ranges?.[k]) && c.ranges[k] > 0) &&
    typeof c.baseline === 'object' &&
    (c.guard === null || (isNum(c.guard?.smile) && isNum(c.guard?.jawOpen)))
  );
}

export function loadCalibration(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return isValidCalibration(parsed) ? parsed : DEFAULT_CALIBRATION;
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
