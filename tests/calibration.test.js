import { describe, it, expect } from 'vitest';
import {
  percentile,
  calibrationSteps,
  repPeaks,
  gestureForKey,
  analyzeRest,
  analyzeGesture,
  buildCalibration,
} from '../src/gestures/calibration.js';
import { DEFAULT_SETTINGS as S, DEFAULT_CALIBRATION as D } from '../src/storage/default-settings.js';
import { HEAD_SETTINGS } from './helpers/settings.js';

const FRAME_MS = 33;

/** Frames from segments like [{ ms: 1000, yaw: 30, eyes: 0, smile: 0, jaw: 0 }]. */
function frames(segments) {
  const out = [];
  let t = 0;
  for (const { ms, yaw = 0, pitch = 0, eyes = 0, smile = 0, jaw = 0, face = true } of segments) {
    for (const end = t + ms; t < end; t += FRAME_MS) {
      out.push({
        t,
        faceFound: face,
        yaw,
        pitch,
        roll: 0,
        blendshapes: face
          ? { eyeBlinkLeft: eyes, eyeBlinkRight: eyes, mouthSmileLeft: smile, mouthSmileRight: smile, jawOpen: jaw }
          : {},
      });
    }
  }
  return out;
}

/** Three held turns of `deg` with rests between, starting from `base`. */
const threeTurns = (deg, base = 0, holdMs = 1000) =>
  frames([
    { ms: 800, yaw: base },
    { ms: holdMs, yaw: base + deg }, { ms: 1200, yaw: base },
    { ms: holdMs, yaw: base + deg }, { ms: 1200, yaw: base },
    { ms: holdMs, yaw: base + deg }, { ms: 1200, yaw: base },
  ]);

describe('helpers', () => {
  it('percentile', () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('repPeaks finds each repetition peak (and one still going at the end)', () => {
    expect(repPeaks([0, 5, 9, 4, 0, 0, 6, 8, 1, 0, 7], 4, 2)).toEqual([9, 8, 7]);
  });

  it('calibrationSteps: rest first, then each range key once', () => {
    expect(calibrationSteps(S.gestureMap)).toEqual(['rest', 'eyesLeft', 'eyesRight', 'eyesUp', 'eyesClosed']); // eye defaults
    expect(calibrationSteps(HEAD_SETTINGS.gestureMap)).toEqual(['rest', 'headLeft', 'headRight', 'eyesClosed']);
  });

  it('gestureForKey prefers longBlink over the 3s pause for eyesClosed', () => {
    expect(gestureForKey('eyesClosed', S.gestureMap)).toBe('longBlink');
    expect(gestureForKey('headLeft', S.gestureMap)).toBe('headLeft');
  });
});

describe('analyzeRest', () => {
  it('records their resting pose (e.g. reclined, head turned a little)', () => {
    const r = analyzeRest(frames([{ ms: 5000, yaw: 8, pitch: -20, eyes: 0.1 }]), S);
    expect(r.ok).toBe(true);
    expect(r.neutral).toEqual({ yaw: 8, pitch: -20, roll: 0 });
    expect(r.baseline.eyesClosed).toBeCloseTo(0.1);
  });

  it('keeps default guard thresholds for a closed resting mouth', () => {
    expect(analyzeRest(frames([{ ms: 5000 }]), S).guard).toEqual({ smile: 0.3, jawOpen: 0.15 });
  });

  it('raises the guard above a resting open mouth, so it does not block everything', () => {
    const r = analyzeRest(frames([{ ms: 5000, jaw: 0.2, smile: 0.25 }]), S);
    expect(r.guard.jawOpen).toBeCloseTo(0.3);
    expect(r.guard.smile).toBeCloseTo(0.4);
  });

  it('fails when the face is mostly not visible', () => {
    expect(analyzeRest(frames([{ ms: 1000 }, { ms: 4000, face: false }]), S)).toEqual({ ok: false, reason: 'noFace' });
  });
});

describe('analyzeGesture', () => {
  const rest = analyzeRest(frames([{ ms: 5000 }]), S);

  it('measures their range and counts real detections', () => {
    const r = analyzeGesture('headLeft', threeTurns(30), rest, S);
    expect(r).toMatchObject({ ok: true, reps: 3 });
    expect(r.range).toBeCloseTo(30);
  });

  it('measures from their resting pose, not from straight ahead', () => {
    const reclinedRest = analyzeRest(frames([{ ms: 5000, yaw: 10 }]), S);
    const r = analyzeGesture('headLeft', threeTurns(25, 10), reclinedRest, S);
    expect(r.range).toBeCloseTo(25);
  });

  it('one extra-big repetition does not inflate the range (median of peaks)', () => {
    const f = frames([
      { ms: 800 },
      { ms: 1000, yaw: 25 }, { ms: 1200 },
      { ms: 1000, yaw: 25 }, { ms: 1200 },
      { ms: 1000, yaw: 60 }, { ms: 1200 },
    ]);
    expect(analyzeGesture('headLeft', f, rest, S).range).toBeCloseTo(25);
  });

  it('fails as tooSmall when the user can barely do it', () => {
    expect(analyzeGesture('headLeft', threeTurns(3), rest, S)).toMatchObject({ ok: false, reason: 'tooSmall' });
  });

  it('fails as notDetected when turns are too brief to be held', () => {
    expect(analyzeGesture('headLeft', threeTurns(30, 0, 300), rest, S)).toMatchObject({
      ok: false,
      reason: 'notDetected',
      reps: 0,
    });
  });

  it('works for long blinks with a sub-1.0 closed score', () => {
    const f = frames([
      { ms: 800 },
      { ms: 1500, eyes: 0.8 }, { ms: 1500 },
      { ms: 1500, eyes: 0.8 }, { ms: 1500 },
      { ms: 1500, eyes: 0.8 }, { ms: 1500 },
    ]);
    expect(analyzeGesture('eyesClosed', f, rest, S)).toMatchObject({ ok: true, reps: 3 });
  });

  it('fails as noFace when the face is mostly lost', () => {
    expect(analyzeGesture('headLeft', frames([{ ms: 5000, face: false }]), rest, S).reason).toBe('noFace');
  });
});

describe('buildCalibration', () => {
  const rest = analyzeRest(frames([{ ms: 5000, yaw: 5 }]), S);

  it('uses new ranges where successful and keeps old ones for failed/skipped steps', () => {
    const c = buildCalibration(
      rest,
      { headLeft: { ok: true, range: 30, reps: 3 }, headRight: { ok: false, reason: 'tooSmall' }, eyesClosed: undefined },
      D,
      new Date('2026-11-22T10:00:00Z')
    );
    expect(c.version).toBe(2);
    expect(c.neutral.yaw).toBe(5);
    expect(c.ranges.headLeft).toBe(30);
    expect(c.ranges.headRight).toBe(D.ranges.headRight);
    expect(c.ranges.eyesClosed).toBe(D.ranges.eyesClosed);
    expect(c.guard).toEqual(rest.guard);
    expect(c.createdAt).toBe('2026-11-22T10:00:00.000Z');
  });
});
