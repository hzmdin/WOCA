import { describe, it, expect } from 'vitest';
import {
  mergeSettings,
  validateSettings,
  loadSettings,
  saveSettings,
  pickEditable,
  setPath,
  getPath,
  SETTINGS_KEY,
} from '../src/storage/settings-store.js';
import { DEFAULT_SETTINGS } from '../src/storage/default-settings.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

describe('path helpers', () => {
  it('get and set nested values without changing the original', () => {
    const o = { a: { b: 1 } };
    const o2 = setPath(o, 'a.c', 2);
    expect(getPath(o2, 'a.c')).toBe(2);
    expect(o.a.c).toBeUndefined();
  });
});

describe('mergeSettings', () => {
  it('nothing stored → defaults', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('applies valid stored values, keeps everything else', () => {
    const s = mergeSettings({ holdMs: 900, gestureMap: { HELP: 'headUp' }, voice: { rate: 1.1 } });
    expect(s.holdMs).toBe(900);
    expect(s.gestureMap.HELP).toBe('headUp');
    expect(s.gestureMap.SELECT).toBe('longBlink');
    expect(s.voice).toEqual({ ...DEFAULT_SETTINGS.voice, rate: 1.1 });
  });

  it('ignores out-of-range, wrong-type and unknown values', () => {
    const s = mergeSettings({ holdMs: 50, thresholdPct: 'high', gestureMap: { SELECT: 'dance' }, releasePct: 0.9 });
    expect(s.holdMs).toBe(DEFAULT_SETTINGS.holdMs);
    expect(s.thresholdPct).toBe(DEFAULT_SETTINGS.thresholdPct);
    expect(s.gestureMap.SELECT).toBe('longBlink');
    expect(s.releasePct).toBe(DEFAULT_SETTINGS.releasePct); // not editable → never stored
  });

  it('a stored null mapping switches an event off', () => {
    expect(mergeSettings({ gestureMap: { PAUSE: null } }).gestureMap.PAUSE).toBeNull();
  });
});

describe('validateSettings', () => {
  it('defaults are valid', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('one movement cannot do two jobs', () => {
    const s = setPath(DEFAULT_SETTINGS, 'gestureMap.HELP', 'eyesClosed3s'); // already PAUSE
    expect(validateSettings(s)).toContainEqual({ code: 'duplicate', path: 'gestureMap.HELP' });
  });

  it('SELECT and at least one direction are required', () => {
    let s = setPath(DEFAULT_SETTINGS, 'gestureMap.SELECT', null);
    expect(validateSettings(s)).toContainEqual({ code: 'required', path: 'gestureMap.SELECT' });
    s = setPath(setPath(DEFAULT_SETTINGS, 'gestureMap.LEFT', null), 'gestureMap.RIGHT', null);
    expect(validateSettings(s)).toContainEqual({ code: 'required', path: 'gestureMap.LEFT' });
  });

  it('one direction is enough (the highlight wraps around)', () => {
    expect(validateSettings(setPath(DEFAULT_SETTINGS, 'gestureMap.RIGHT', null))).toEqual([]);
  });

  it('numbers outside their range are invalid', () => {
    expect(validateSettings(setPath(DEFAULT_SETTINGS, 'holdMs', 5000))).toContainEqual({ code: 'invalid', path: 'holdMs' });
  });

  it('smile is allowed as an opt-in choice', () => {
    expect(validateSettings(setPath(DEFAULT_SETTINGS, 'gestureMap.HELP', 'smile'))).toEqual([]);
  });
});

describe('load / save', () => {
  it('saves only editable values and loads them back merged with defaults', () => {
    const storage = memoryStorage();
    const edited = setPath(DEFAULT_SETTINGS, 'holdMs', 800);
    expect(saveSettings(edited, storage)).toBe(true);
    const stored = JSON.parse(storage.data[SETTINGS_KEY]);
    expect(stored.holdMs).toBe(800);
    expect(stored.releasePct).toBeUndefined(); // developer-only values are never stored
    expect(loadSettings(storage)).toEqual(edited);
  });

  it('refuses to save invalid settings', () => {
    const storage = memoryStorage();
    expect(saveSettings(setPath(DEFAULT_SETTINGS, 'gestureMap.SELECT', null), storage)).toBe(false);
    expect(storage.data[SETTINGS_KEY]).toBeUndefined();
  });

  it('corrupted or blocked storage → defaults, no crash', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{oops' }))).toBe(DEFAULT_SETTINGS);
    expect(loadSettings(broken)).toBe(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS, broken)).toBe(false);
  });

  it('pickEditable has every editable path', () => {
    const p = pickEditable(DEFAULT_SETTINGS);
    expect(p.gestureMap.SELECT).toBe('longBlink');
    expect(p.voice.rate).toBe(0.9);
    expect(p.calibration).toBeUndefined();
  });
});
