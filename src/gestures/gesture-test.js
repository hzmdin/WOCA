// "Find the best gesture": the caregiver asks the user to try each gesture a few
// times; the REAL gesture engine decides whether it was detected, so the result
// is what WOCA will actually do. Between tries the user rests, and anything the
// engine detects then counts as an accidental trigger (those are the dangerous
// ones: AGENTS.md principle 1).
// Pure (no DOM): createTest → stepTest(state, signals, ctx) each frame → summarize.
import { createEngineState, stepEngine } from './gesture-engine.js';

/** Gestures that make sense as SELECT, in the order they are tested. */
export const TEST_GESTURES = Object.freeze([
  'longBlink', 'eyesLeft', 'eyesRight', 'eyesUp', 'headLeft', 'headRight', 'headUp', 'browUp', 'smile', 'mouthOpen',
]);
/** Smile and mouth-open are opt-in only (laughing and talking trigger them), so they are not tested unless asked. */
const OPT_IN = ['smile', 'mouthOpen'];
export const DEFAULT_TEST_GESTURES = Object.freeze(TEST_GESTURES.filter((g) => !OPT_IN.includes(g)));

const emptyResult = (gesture) => ({ gesture, hits: 0, hitMs: [], falseFires: 0, trials: 0, skipped: false });

function startGesture(state, gi, t) {
  if (gi >= state.gestures.length) return { ...state, gi, phase: 'done', phaseStart: t };
  return {
    ...state,
    gi,
    trial: 0,
    phase: 'intro',
    phaseStart: t,
    engine: createEngineState({ SELECT: state.gestures[gi] }),
  };
}

/** @param gestures which gestures to test (a subset of TEST_GESTURES, in test order) */
export function createTest(gestures = DEFAULT_TEST_GESTURES) {
  const list = TEST_GESTURES.filter((g) => gestures.includes(g));
  const state = {
    gestures: list,
    gi: 0,
    trial: 0,
    phase: 'intro', // intro → rest → prompt → rest → prompt … → next gesture's intro … → done
    phaseStart: null,
    lastT: null,
    engine: null,
    results: list.map(emptyResult),
    lastOutcome: null, // 'hit' | 'miss' after each try, for the screen
  };
  return list.length ? startGesture(state, 0, null) : { ...state, phase: 'done' };
}

function finishTry(state, t, outcome, hitMs) {
  const results = state.results.map((r, i) =>
    i === state.gi
      ? { ...r, trials: r.trials + 1, hits: r.hits + (outcome === 'hit' ? 1 : 0), hitMs: outcome === 'hit' ? [...r.hitMs, hitMs] : r.hitMs }
      : r
  );
  return { ...state, results, lastOutcome: outcome, trial: state.trial + 1, phase: 'rest', phaseStart: t };
}

/**
 * @param ctx { settings, calibration } the app's real settings (settings.gestureTest has the timings)
 * While the face is not visible the clock waits: a lost face is not a missed try.
 */
export function stepTest(state, signals, { settings, calibration }) {
  if (state.phase === 'done') return state;
  const t = signals.t;
  const timing = settings.gestureTest;
  const dt = state.lastT === null ? 0 : t - state.lastT;
  let s = { ...state, lastT: t, phaseStart: state.phaseStart ?? t };

  const out = stepEngine(s.engine, signals, { settings: { ...settings, gestureMap: { SELECT: s.gestures[s.gi] } }, calibration });
  s = { ...s, engine: out.state };
  if (!signals.faceFound) return { ...s, phaseStart: s.phaseStart + dt };

  const fired = out.events.some((e) => e.type === 'SELECT');
  const elapsed = t - s.phaseStart;

  if (s.phase === 'intro') {
    return elapsed >= timing.introMs ? { ...s, phase: 'rest', phaseStart: t } : s;
  }
  if (s.phase === 'rest') {
    if (fired) s = { ...s, results: s.results.map((r, i) => (i === s.gi ? { ...r, falseFires: r.falseFires + 1 } : r)) };
    return elapsed >= timing.restMs ? { ...s, phase: 'prompt', phaseStart: t } : s;
  }
  // prompt: the user should do the gesture now
  let next = s;
  if (fired) next = finishTry(s, t, 'hit', elapsed);
  else if (elapsed >= timing.promptMs) next = finishTry(s, t, 'miss', null);
  if (next.trial >= timing.trials) next = startGesture({ ...next, lastOutcome: next.lastOutcome }, next.gi + 1, t);
  return next;
}

/** Skip the gesture being tested (the user can't do it, or is tired). */
export function skipGesture(state, t = null) {
  if (state.phase === 'done') return state;
  const results = state.results.map((r, i) => (i === state.gi ? { ...r, skipped: true } : r));
  return startGesture({ ...state, results }, state.gi + 1, t);
}

/**
 * Rate every tested gesture and pick the best one for SELECT.
 *   good: every try detected and no accidental trigger
 *   ok:   at least okFraction of tries detected, at most one accidental trigger
 *   poor: anything else
 * Best = most hits, then fewest accidental triggers, then fastest.
 * @returns { rows: [{ gesture, trials, hits, falseFires, avgMs, rating, skipped }], best: string|null }
 */
export function summarize(results, { okFraction }) {
  const rows = results.map((r) => {
    const avgMs = r.hitMs.length ? r.hitMs.reduce((a, b) => a + b, 0) / r.hitMs.length : null;
    let rating = 'poor';
    if (r.trials > 0 && r.hits === r.trials && r.falseFires === 0) rating = 'good';
    else if (r.trials > 0 && r.hits / r.trials >= okFraction && r.falseFires <= 1) rating = 'ok';
    return { gesture: r.gesture, trials: r.trials, hits: r.hits, falseFires: r.falseFires, avgMs, rating, skipped: r.skipped };
  });
  const order = (a, b) => b.hits - a.hits || a.falseFires - b.falseFires || (a.avgMs ?? Infinity) - (b.avgMs ?? Infinity);
  const tested = rows.filter((r) => !r.skipped && r.trials > 0).sort(order);
  const best = tested.find((r) => r.rating !== 'poor')?.gesture ?? null;
  return { rows: [...tested, ...rows.filter((r) => r.skipped || r.trials === 0)], best };
}
