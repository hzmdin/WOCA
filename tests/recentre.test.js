import { describe, it, expect } from 'vitest';
import { recentre, createDriftState, stepDrift } from '../src/gestures/recentre.js';
import { createEngineState, stepEngine } from '../src/gestures/gesture-engine.js';
import { DEFAULT_CALIBRATION as D } from '../src/storage/default-settings.js';
import { HEAD_SETTINGS as S } from './helpers/settings.js'; // re-centre is about head pose

const FRAME_MS = 33;

function frames(segments) {
  const out = [];
  let t = 0;
  for (const { ms, yaw = 0, pitch = 0, look = 0, eyes = 0, face = true, wobble = 0 } of segments) {
    for (const end = t + ms; t < end; t += FRAME_MS) {
      const w = wobble ? Math.sin(t / 150) * wobble : 0;
      out.push({
        t,
        faceFound: face,
        yaw: yaw + w,
        pitch,
        roll: 0,
        blendshapes: face
          ? { eyeLookDownLeft: look, eyeLookDownRight: look, eyeBlinkLeft: eyes, eyeBlinkRight: eyes }
          : {},
      });
    }
  }
  return out;
}

const calibrated = {
  ...D,
  neutral: { yaw: 0, pitch: 0, roll: 0 },
  baseline: { ...D.baseline, eyesClosed: 0.08, smile: 0.02 },
  ranges: { ...D.ranges, headLeft: 20, headRight: 20 },
  guard: { smile: 0.3, jawOpen: 0.2 },
  createdAt: '2026-11-22T10:00:00.000Z',
};

function events(calibration, fs) {
  let state = createEngineState(S.gestureMap);
  const out = [];
  for (const f of fs) {
    const r = stepEngine(state, f, { settings: S, calibration });
    state = r.state;
    out.push(...r.events.map((e) => e.type));
  }
  return out;
}

describe('recentre', () => {
  it('updates the resting head pose and eye direction only', () => {
    const r = recentre(calibrated, frames([{ ms: 2000, yaw: 8, pitch: -20, look: 0.5 }]), S, new Date('2026-11-23T08:00:00Z'));
    expect(r.ok).toBe(true);
    expect(r.calibration.neutral).toEqual({ yaw: 8, pitch: -20, roll: 0 });
    expect(r.calibration.baseline.eyesDown).toBeCloseTo(0.5);
    // kept from the calibration
    expect(r.calibration.ranges).toEqual(calibrated.ranges);
    expect(r.calibration.guard).toEqual(calibrated.guard);
    expect(r.calibration.baseline.eyesClosed).toBe(0.08);
    expect(r.calibration.baseline.smile).toBe(0.02);
    expect(r.calibration.createdAt).toBe(calibrated.createdAt);
    expect(r.calibration.recentredAt).toBe('2026-11-23T08:00:00.000Z');
  });

  it('does not change the original calibration object', () => {
    const before = JSON.stringify(calibrated);
    recentre(calibrated, frames([{ ms: 2000, yaw: 8 }]), S);
    expect(JSON.stringify(calibrated)).toBe(before);
  });

  it('fails if the user is moving (head not still)', () => {
    expect(recentre(calibrated, frames([{ ms: 2000, wobble: 10 }]), S)).toEqual({ ok: false, reason: 'moving' });
  });

  it('small natural wobble is fine', () => {
    expect(recentre(calibrated, frames([{ ms: 2000, yaw: 5, wobble: 1.5 }]), S).ok).toBe(true);
  });

  it('fails if the face is not visible', () => {
    expect(recentre(calibrated, frames([{ ms: 2000, face: false }]), S)).toEqual({ ok: false, reason: 'noFace' });
  });

  it('task 2.6 done check: gestures work at two bed angles after re-centring', () => {
    // Bed raised: the user's resting head is now 8° to their left and tilted back.
    const rest = { yaw: 8, pitch: -20 };
    const turnRight = frames([{ ms: 500, ...rest }, { ms: 800, yaw: -7, pitch: -20 }, { ms: 500, ...rest }]);
    const turnLeft = frames([{ ms: 500, ...rest }, { ms: 800, yaw: 23, pitch: -20 }, { ms: 500, ...rest }]);

    // Without re-centring: the 15° right turn from the user's new rest is missed.
    expect(events(calibrated, turnRight)).toEqual([]);

    const r = recentre(calibrated, frames([{ ms: 2000, ...rest }]), S);
    expect(events(r.calibration, turnRight)).toEqual(['RIGHT']);
    expect(events(r.calibration, turnLeft)).toEqual(['LEFT']);
    // and simply resting at the new angle triggers nothing
    expect(events(r.calibration, frames([{ ms: 5000, ...rest }]))).toEqual([]);
  });
});

describe('drift watch', () => {
  const cfg = { settings: S, calibration: calibrated };

  function run(fs, engineOut = { events: [], guarded: false }) {
    let state = createDriftState();
    let suggest = false;
    for (const f of fs) ({ state, suggest } = stepDrift(state, f, engineOut, cfg));
    return suggest;
  }

  it('suggests re-centring when their head stays off-centre for 10s', () => {
    expect(run(frames([{ ms: 10500, yaw: 9, pitch: -5 }]))).toBe(true); // 9/20 = 0.45 > release 0.3
  });

  it('does not suggest for shorter periods', () => {
    expect(run(frames([{ ms: 8000, yaw: 9 }]))).toBe(false);
  });

  it('does not suggest when the user is at rest', () => {
    expect(run(frames([{ ms: 12000, yaw: 2 }]))).toBe(false);
  });

  it('a return to centre resets the timer', () => {
    expect(run(frames([{ ms: 6000, yaw: 9 }, { ms: 100 }, { ms: 6000, yaw: 9 }]))).toBe(false);
  });

  it('never suggests while the face is lost or the guard is active', () => {
    expect(run(frames([{ ms: 12000, yaw: 9, face: false }]))).toBe(false);
    expect(run(frames([{ ms: 12000, yaw: 9 }]), { events: [], guarded: true })).toBe(false);
  });
});
