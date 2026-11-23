// Caregiver-editable settings, saved in localStorage.
// Only the fields listed in EDITABLE are stored; everything else always comes
// from DEFAULT_SETTINGS, so improved defaults still reach an existing install.
// Anything missing, invalid or corrupted falls back to the default value.
import { DEFAULT_SETTINGS, AVAILABLE_GESTURES } from './default-settings.js';

export const SETTINGS_KEY = 'woca.settings';

export const EVENTS = Object.freeze(['LEFT', 'RIGHT', 'SELECT', 'PAUSE', 'HELP', 'BACK', 'UP', 'DOWN']);

/** What the settings screen can change, with the allowed range for numbers. */
export const EDITABLE = Object.freeze([
  ...EVENTS.map((e) => ({ path: `gestureMap.${e}`, type: 'gesture' })),
  { path: 'thresholdPct', type: 'number', min: 0.3, max: 0.9, step: 0.05 },
  { path: 'closedThresholdPct', type: 'number', min: 0.6, max: 0.95, step: 0.05 },
  { path: 'holdMs', type: 'number', min: 300, max: 2000, step: 100 },
  { path: 'cooldownMs', type: 'number', min: 300, max: 3000, step: 100 },
  { path: 'longBlinkMs', type: 'number', min: 600, max: 2500, step: 100 },
  { path: 'eventHoldMs.HELP', type: 'number', min: 1000, max: 5000, step: 250 },
  { path: 'expressionGuard.enabled', type: 'bool' },
  { path: 'voice.name', type: 'voice' },
  { path: 'voice.rate', type: 'number', min: 0.5, max: 1.5, step: 0.05 },
  { path: 'help.volume', type: 'number', min: 0.1, max: 1, step: 0.05 },
  { path: 'board.yesSide', type: 'side' },
  { path: 'board.tileColors', type: 'bool' },
  { path: 'board.returnHomeMs', type: 'number', min: 1000, max: 10000, step: 500 },
  { path: 'breakReminder.afterMin', type: 'number', min: 5, max: 60, step: 5 },
]);

export const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

/** Copy of obj with path set to value (obj itself is not changed). */
export function setPath(obj, path, value) {
  const [key, ...rest] = path.split('.');
  return { ...obj, [key]: rest.length ? setPath(obj?.[key] ?? {}, rest.join('.'), value) : value };
}

/** Is value acceptable for this editable field? */
export function isValidValue(field, value) {
  switch (field.type) {
    case 'gesture': return value === null || AVAILABLE_GESTURES.includes(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max;
    case 'bool': return typeof value === 'boolean';
    case 'voice': return value === null || (typeof value === 'string' && value.length > 0);
    case 'side': return value === 'left' || value === 'right';
    default: return false;
  }
}

/** Defaults with every valid stored editable value applied. */
export function mergeSettings(stored, defaults = DEFAULT_SETTINGS) {
  let out = defaults;
  for (const field of EDITABLE) {
    const value = getPath(stored, field.path);
    if (value !== undefined && isValidValue(field, value)) out = setPath(out, field.path, value);
  }
  return out;
}

/**
 * Problems that must be fixed before saving. Each: { code, path }.
 *   invalid   – value outside its allowed range/type
 *   duplicate – one movement used for two events
 *   required  – SELECT, and LEFT or RIGHT, must have a movement
 */
export function validateSettings(settings) {
  const errors = [];
  for (const field of EDITABLE) {
    if (!isValidValue(field, getPath(settings, field.path))) errors.push({ code: 'invalid', path: field.path });
  }
  const seen = new Map();
  for (const event of EVENTS) {
    const gesture = settings.gestureMap?.[event];
    if (!gesture) continue;
    if (seen.has(gesture)) errors.push({ code: 'duplicate', path: `gestureMap.${event}` });
    else seen.set(gesture, event);
  }
  if (!settings.gestureMap?.SELECT) errors.push({ code: 'required', path: 'gestureMap.SELECT' });
  if (!settings.gestureMap?.LEFT && !settings.gestureMap?.RIGHT) errors.push({ code: 'required', path: 'gestureMap.LEFT' });
  return errors;
}

/** Only the editable values (what gets stored and exported). */
export function pickEditable(settings) {
  let out = {};
  for (const field of EDITABLE) out = setPath(out, field.path, getPath(settings, field.path));
  return out;
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    return mergeSettings(JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null') ?? {});
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** @returns true if saved (refuses settings that fail validation) */
export function saveSettings(settings, storage = globalThis.localStorage) {
  if (validateSettings(settings).length) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(pickEditable(settings)));
    return true;
  } catch {
    return false;
  }
}

export function clearSettings(storage = globalThis.localStorage) {
  try {
    storage.removeItem(SETTINGS_KEY);
  } catch {
    /* nothing to clear */
  }
}
