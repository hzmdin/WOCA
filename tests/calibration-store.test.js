import { describe, it, expect } from 'vitest';
import {
  loadCalibration,
  saveCalibration,
  clearCalibration,
  isValidCalibration,
  STORAGE_KEY,
} from '../src/storage/calibration-store.js';
import { DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}

const valid = {
  ...DEFAULT_CALIBRATION,
  neutral: { yaw: 5, pitch: -10, roll: 1 },
  ranges: { ...DEFAULT_CALIBRATION.ranges, headLeft: 30 },
  guard: { smile: 0.3, jawOpen: 0.2 },
  createdAt: '2026-11-22T10:00:00.000Z',
};

describe('calibration store', () => {
  it('returns defaults when nothing is saved', () => {
    expect(loadCalibration(memoryStorage())).toBe(DEFAULT_CALIBRATION);
  });

  it('saves and loads a calibration (survives reload)', () => {
    const storage = memoryStorage();
    expect(saveCalibration(valid, storage)).toBe(true);
    expect(loadCalibration(storage)).toEqual(valid);
  });

  it('falls back to defaults for corrupted data instead of crashing', () => {
    expect(loadCalibration(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toBe(DEFAULT_CALIBRATION);
    expect(loadCalibration(memoryStorage({ [STORAGE_KEY]: '{"version":2}' }))).toBe(DEFAULT_CALIBRATION);
  });

  it('refuses to save an invalid calibration (e.g. a zero range)', () => {
    const storage = memoryStorage();
    expect(saveCalibration({ ...valid, ranges: { ...valid.ranges, headLeft: 0 } }, storage)).toBe(false);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it('survives storage that throws (private mode, blocked storage)', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    expect(loadCalibration(broken)).toBe(DEFAULT_CALIBRATION);
    expect(saveCalibration(valid, broken)).toBe(false);
    expect(() => clearCalibration(broken)).not.toThrow();
  });

  it('defaults are valid', () => {
    expect(isValidCalibration(DEFAULT_CALIBRATION)).toBe(true);
  });
});
