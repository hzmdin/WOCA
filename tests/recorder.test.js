import { describe, it, expect } from 'vitest';
import {
  createRecording,
  compactFrame,
  fixtureFileName,
  RECORDING_LABELS,
  FIXTURE_VERSION,
} from '../src/vision/recorder.js';

const signals = (t, extra = {}) => ({
  t,
  faceFound: true,
  yaw: 12.345678,
  pitch: -3.21987,
  roll: 0.5,
  blendshapes: { eyeBlinkLeft: 0.812345, mouthSmileLeft: 0.0001 },
  ...extra,
});

describe('compactFrame', () => {
  it('makes time relative and rounds values', () => {
    expect(compactFrame(signals(5033.7), 5000)).toEqual({
      t: 34,
      faceFound: true,
      yaw: 12.35,
      pitch: -3.22,
      roll: 0.5,
      blendshapes: { eyeBlinkLeft: 0.812, mouthSmileLeft: 0 },
    });
  });

  it('keeps face-lost frames', () => {
    const f = compactFrame({ t: 10, faceFound: false, yaw: 0, pitch: 0, roll: 0, blendshapes: {} }, 0);
    expect(f.faceFound).toBe(false);
  });
});

describe('createRecording', () => {
  it('records until the duration is reached, then refuses more frames', () => {
    const rec = createRecording('laugh', { durationMs: 100 });
    const accepted = [];
    for (let t = 1000; t < 1200; t += 33) accepted.push(rec.add(signals(t)));
    expect(accepted.filter(Boolean)).toHaveLength(4); // t = 0, 33, 66, 99
    expect(accepted.at(-1)).toBe(false);
  });

  it('produces a fixture with metadata and frames only (no images)', () => {
    const rec = createRecording('headLeft', {
      durationMs: 1000,
      now: () => new Date('2026-11-22T15:04:05.123Z'),
    });
    for (let t = 0; t < 200; t += 33) rec.add(signals(t));
    const fx = rec.finish();
    expect(fx).toMatchObject({
      version: FIXTURE_VERSION,
      label: 'headLeft',
      recordedAt: '2026-11-22T15:04:05.123Z',
      frameCount: 7,
      durationMs: 198,
    });
    expect(Object.keys(fx.frames[0]).sort()).toEqual(
      ['blendshapes', 'faceFound', 'pitch', 'roll', 't', 'yaw'].sort()
    );
  });

  it('rejects unknown labels (tests rely on the label names)', () => {
    expect(() => createRecording('dance')).toThrow(/unknown recording label/);
  });

  it('offers the labels the regression tests need', () => {
    for (const l of ['neutral', 'headLeft', 'headRight', 'longBlink', 'laugh', 'talk']) {
      expect(RECORDING_LABELS[l]).toBeTruthy();
    }
  });
});

describe('fixtureFileName', () => {
  it('is Windows-safe (no colons)', () => {
    expect(fixtureFileName({ label: 'laugh', recordedAt: '2026-11-22T15:04:05.123Z' })).toBe(
      'laugh-2026-11-22T15-04-05.json'
    );
  });
});
