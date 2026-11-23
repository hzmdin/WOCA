import { describe, it, expect } from 'vitest';
import { createTest, stepTest, skipGesture, summarize, TEST_GESTURES, DEFAULT_TEST_GESTURES } from '../src/gestures/gesture-test.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';

const FRAME_MS = 33;
const ctx = { settings: DEFAULT_SETTINGS, calibration: DEFAULT_CALIBRATION };
const frame = (t, { yaw = 0, face = true } = {}) => ({ t, faceFound: face, yaw, pitch: 0, roll: 0, blendshapes: face ? {} : {} });

/** Run a simulated user. pose(state, t) says how the user moves right now. */
function run(gestures, pose, { maxMs = 120000 } = {}) {
  let state = createTest(gestures);
  for (let t = 0; t < maxMs && state.phase !== 'done'; t += FRAME_MS) {
    state = stepTest(state, frame(t, pose(state, t)), ctx);
  }
  return state;
}

/** Does the right gesture whenever asked, rests otherwise. */
const obedient = (state) => {
  if (state.phase !== 'prompt') return {};
  return { yaw: state.gestures[state.gi] === 'headLeft' ? 25 : -25 };
};

describe('stepTest', () => {
  it('an obedient user gets every try detected, no accidents, rated good', () => {
    const state = run(['headLeft'], obedient);
    expect(state.phase).toBe('done');
    const { rows, best } = summarize(state.results, ctx.settings.gestureTest);
    expect(rows[0]).toMatchObject({ gesture: 'headLeft', trials: 3, hits: 3, falseFires: 0, rating: 'good' });
    expect(rows[0].avgMs).toBeGreaterThan(ctx.settings.holdMs - 100); // detected only after the hold time
    expect(best).toBe('headLeft');
  });

  it('a user who cannot do the gesture misses every try, and nothing is recommended', () => {
    const state = run(['headLeft'], () => ({}));
    const { rows, best } = summarize(state.results, ctx.settings.gestureTest);
    expect(rows[0]).toMatchObject({ trials: 3, hits: 0, rating: 'poor' });
    expect(best).toBeNull();
  });

  it('counts a detection during rest as an accidental trigger', () => {
    const fidgety = (state, t) => {
      if (state.phase === 'rest' && t - state.phaseStart > 300 && t - state.phaseStart < 1400) return { yaw: 25 };
      return obedient(state);
    };
    const state = run(['headLeft'], fidgety);
    const [row] = summarize(state.results, ctx.settings.gestureTest).rows;
    expect(row.falseFires).toBeGreaterThan(0);
    expect(row.rating).not.toBe('good');
  });

  it('waits while the face is not visible: a lost face is not a missed try', () => {
    // face hidden for 20 s from the start: still at the intro, nothing counted
    let state = createTest(['headLeft']);
    for (let t = 0; t < 20000; t += FRAME_MS) state = stepTest(state, frame(t, { face: false }), ctx);
    expect(state.phase).toBe('intro');
    expect(state.results[0].trials).toBe(0);
    // face hidden for 8 s in the middle of a prompt: that try is not lost
    state = createTest(['headLeft']);
    let t = 0;
    while (state.phase !== 'prompt') state = stepTest(state, frame((t += FRAME_MS)), ctx);
    for (let i = 0; i < 8000 / FRAME_MS; i++) state = stepTest(state, frame((t += FRAME_MS), { face: false }), ctx);
    expect(state.results[0].trials).toBe(0);
    expect(state.phase).toBe('prompt');
  });

  it('tests several gestures in order and ends when all are done', () => {
    const state = run(['headRight', 'headLeft'], obedient); // test order follows TEST_GESTURES, not the argument
    expect(state.gestures).toEqual(['headLeft', 'headRight']);
    const { rows } = summarize(state.results, ctx.settings.gestureTest);
    expect(rows.map((r) => r.rating)).toEqual(['good', 'good']);
  });

  it('skipping a gesture records it as skipped and moves on', () => {
    let state = createTest(['headLeft', 'headRight']);
    state = skipGesture(state, 0);
    expect(state.gi).toBe(1);
    state = skipGesture(state, 0);
    expect(state.phase).toBe('done');
    expect(summarize(state.results, ctx.settings.gestureTest).rows.every((r) => r.skipped)).toBe(true);
  });

  it('smile is not part of the default test (laughing would cause false triggers)', () => {
    expect(TEST_GESTURES).toContain('smile');
    expect(DEFAULT_TEST_GESTURES).not.toContain('smile');
  });
});

describe('summarize', () => {
  const r = (gesture, hits, falseFires, ms = 800) => ({ gesture, hits, hitMs: Array(hits).fill(ms), falseFires, trials: 3, skipped: false });
  const opts = { okFraction: 0.66 };

  it('rates good / ok / poor', () => {
    const { rows } = summarize([r('headLeft', 3, 0), r('eyesLeft', 2, 1), r('eyesUp', 1, 0), r('headRight', 3, 2)], opts);
    const rating = Object.fromEntries(rows.map((x) => [x.gesture, x.rating]));
    expect(rating).toEqual({ headLeft: 'good', eyesLeft: 'ok', eyesUp: 'poor', headRight: 'poor' });
  });

  it('best = most hits, then fewest accidents, then fastest', () => {
    expect(summarize([r('headLeft', 3, 0, 900), r('headRight', 3, 0, 700), r('eyesLeft', 2, 0)], opts).best).toBe('headRight');
    expect(summarize([r('headLeft', 3, 1), r('headRight', 3, 0)], opts).best).toBe('headRight');
    expect(summarize([r('eyesLeft', 2, 0), r('headLeft', 3, 0)], opts).best).toBe('headLeft');
  });

  it('a gesture with accidental triggers is never recommended over a clean one', () => {
    expect(summarize([r('longBlink', 3, 3), r('headLeft', 2, 0)], opts).best).toBe('headLeft');
  });
});
