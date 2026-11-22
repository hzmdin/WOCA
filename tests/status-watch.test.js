import { describe, it, expect } from 'vitest';
import { createFaceLostState, stepFaceLost, createBreakState, stepBreak } from '../src/ui/status-watch.js';
import { DEFAULT_SETTINGS as S } from '../src/storage/default-settings.js';

const FRAME_MS = 33;

describe('face-lost banner', () => {
  /** segments: [{ ms, face }] → banner state after each segment */
  function run(segments) {
    let state = createFaceLostState();
    let show = false;
    let t = 0;
    const after = [];
    for (const { ms, face } of segments) {
      for (const end = t + ms; t < end; t += FRAME_MS) ({ state, show } = stepFaceLost(state, { t, faceFound: face }, S));
      after.push(show);
    }
    return after;
  }

  it('hidden while the face is visible', () => {
    expect(run([{ ms: 5000, face: true }])).toEqual([false]);
  });

  it('shows after 1s without a face', () => {
    expect(run([{ ms: 500, face: false }, { ms: 700, face: false }])).toEqual([false, true]);
  });

  it('does not flicker on brief losses (quick head movement)', () => {
    expect(run([{ ms: 600, face: false }, { ms: 100, face: true }, { ms: 600, face: false }])).toEqual([false, false, false]);
  });

  it('hides quickly once the face is back', () => {
    expect(run([{ ms: 1500, face: false }, { ms: 400, face: true }])).toEqual([true, false]);
  });

  it('a single found frame does not hide it', () => {
    expect(run([{ ms: 1500, face: false }, { ms: 33, face: true }, { ms: 500, face: false }])).toEqual([true, true, true]);
  });
});

describe('break reminder', () => {
  const MIN = 60000;

  /** Simulate use in 1s steps. segments: [{ ms, paused?, face? }] → show after each */
  function run(segments, state = createBreakState(), start = 0) {
    let show = false;
    let t = start;
    const after = [];
    for (const { ms, paused = false, face = true } of segments) {
      for (const end = t + ms; t < end; t += 1000) ({ state, show } = stepBreak(state, t, { paused, faceFound: face }, S));
      after.push(show);
    }
    return { after, state, t };
  }

  it('appears after 15 minutes of use', () => {
    // check at 15:03 (it shows from 15:00 for 10 s)
    expect(run([{ ms: 14 * MIN }, { ms: MIN + 4000 }]).after).toEqual([false, true]);
  });

  it('shows for 10s, then hides and starts counting again', () => {
    const r = run([{ ms: 15 * MIN + 2000 }, { ms: 12000 }]);
    expect(r.after).toEqual([true, false]);
    expect(run([{ ms: 14 * MIN }], r.state, r.t).after).toEqual([false]); // counting from zero
  });

  it('pausing resets the count (the user has rested)', () => {
    expect(run([{ ms: 10 * MIN }, { ms: 60000, paused: true }, { ms: 10 * MIN }]).after).toEqual([false, false, false]);
  });

  it('time without a face (the user is away) does not count', () => {
    expect(run([{ ms: 10 * MIN }, { ms: 30 * MIN, face: false }, { ms: 4 * MIN }]).after).toEqual([false, false, false]);
  });

  it('a long gap between frames (laptop asleep) is not counted as use', () => {
    let state = createBreakState();
    ({ state } = stepBreak(state, 0, { paused: false, faceFound: true }, S));
    const { show } = stepBreak(state, 60 * MIN, { paused: false, faceFound: true }, S);
    expect(show).toBe(false);
  });
});
