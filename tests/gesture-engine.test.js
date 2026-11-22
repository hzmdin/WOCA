import { describe, it, expect } from 'vitest';
import { createEngineState, stepEngine, setPaused } from '../src/gestures/gesture-engine.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';

const FRAME_MS = 33; // ~30 fps
import { HEAD_SETTINGS } from './helpers/settings.js';

// Head-turn setup (LEFT/RIGHT = head), independent of the current defaults.
const settings = HEAD_SETTINGS; // holdMs 600, cooldown 800, threshold 0.6, release 0.3
const calibration = DEFAULT_CALIBRATION; // headLeft/Right range 20°, eyesClosed 0.75

/** One FaceSignals frame. yaw in degrees (+ = the user's left), eyes 0..1 closed. */
const frame = (t, { yaw = 0, pitch = 0, eyes = 0, face = true } = {}) => ({
  t,
  faceFound: face,
  yaw,
  pitch,
  roll: 0,
  blendshapes: face ? { eyeBlinkLeft: eyes, eyeBlinkRight: eyes } : {},
});

/**
 * Simulate segments like [{ ms: 700, yaw: 20 }, { ms: 300 }] at 30 fps.
 * Returns all events with their times.
 */
function simulate(segments, { config = { settings, calibration }, start = 0 } = {}) {
  let state = createEngineState(config.settings.gestureMap);
  const events = [];
  let t = start;
  for (const { ms, ...pose } of segments) {
    const end = t + ms;
    for (; t < end; t += FRAME_MS) {
      const out = stepEngine(state, frame(t, pose), config);
      state = out.state;
      events.push(...out.events);
    }
  }
  return events;
}

const types = (events) => events.map((e) => e.type);

describe('hold gestures (head turn = LEFT/RIGHT)', () => {
  it('ignores a quick flick shorter than holdMs', () => {
    expect(simulate([{ ms: 300, yaw: 20 }, { ms: 500 }])).toEqual([]);
  });

  it('fires exactly once after holding past holdMs', () => {
    const events = simulate([{ ms: 700, yaw: 20 }, { ms: 300 }]);
    expect(types(events)).toEqual(['LEFT']);
    expect(events[0].t).toBeGreaterThanOrEqual(600);
  });

  it('keeps holding for 3s -> still only one event (must return to neutral)', () => {
    expect(types(simulate([{ ms: 3000, yaw: 20 }]))).toEqual(['LEFT']);
  });

  it('fires again after returning to neutral', () => {
    const events = simulate([{ ms: 700, yaw: 20 }, { ms: 500 }, { ms: 700, yaw: 20 }]);
    expect(types(events)).toEqual(['LEFT', 'LEFT']);
  });

  it('does not re-arm if the user only eases back slightly (not to neutral)', () => {
    // 20° fires; easing to 8° (activation 0.4, above releasePct 0.3) is not neutral.
    const events = simulate([{ ms: 700, yaw: 20 }, { ms: 500, yaw: 8 }, { ms: 700, yaw: 20 }]);
    expect(types(events)).toEqual(['LEFT']);
  });

  it('never fires below the threshold', () => {
    expect(simulate([{ ms: 2000, yaw: 10 }])).toEqual([]); // activation 0.5 < 0.6
  });

  it('hysteresis: a dip between release and threshold does not restart the hold', () => {
    // start at 20° (1.0), wobble to 8° (0.4) -> still holding -> fires
    const events = simulate([{ ms: 300, yaw: 20 }, { ms: 100, yaw: 8 }, { ms: 300, yaw: 20 }]);
    expect(types(events)).toEqual(['LEFT']);
  });

  it('RIGHT works with the opposite turn', () => {
    expect(types(simulate([{ ms: 700, yaw: -20 }]))).toEqual(['RIGHT']);
  });

  it('measures from their neutral pose, not from straight ahead', () => {
    const reclined = { ...calibration, neutral: { yaw: 10, pitch: -20, roll: 0 } };
    const config = { settings, calibration: reclined };
    expect(simulate([{ ms: 1000, yaw: 10 }], { config })).toEqual([]); // The user's neutral
    expect(types(simulate([{ ms: 700, yaw: -5 }], { config }))).toEqual(['RIGHT']); // 15° right of neutral
  });
});

describe('face lost', () => {
  it('resets the hold timer, so nothing fires from partial data', () => {
    // 400ms + 400ms of turning would be enough, but a face-lost frame splits it
    const events = simulate([{ ms: 400, yaw: 20 }, { ms: 33, face: false }, { ms: 400, yaw: 20 }]);
    expect(events).toEqual([]);
  });

  it('never emits events while the face is missing', () => {
    expect(simulate([{ ms: 2000, face: false }])).toEqual([]);
  });
});

describe('cooldown', () => {
  it('blocks a second event until cooldownMs after the first', () => {
    // LEFT fires, then the user swings straight to the right and holds
    const events = simulate([{ ms: 640, yaw: 20 }, { ms: 1500, yaw: -20 }]);
    expect(types(events)).toEqual(['LEFT', 'RIGHT']);
    expect(events[1].t - events[0].t).toBeGreaterThanOrEqual(settings.cooldownMs);
  });
});

describe('long blink (SELECT) vs eyes closed 3s (PAUSE)', () => {
  it('ignores a natural blink', () => {
    expect(simulate([{ ms: 200, eyes: 0.8 }, { ms: 500 }])).toEqual([]);
  });

  it('long blink fires SELECT when the user opens their eyes', () => {
    const events = simulate([{ ms: 1500, eyes: 0.8 }, { ms: 300 }]);
    expect(types(events)).toEqual(['SELECT']);
    expect(events[0].t).toBeGreaterThanOrEqual(1500); // on release, not while closed
  });

  it('eyes closed 3s fires PAUSE only, and opening does not also SELECT', () => {
    expect(types(simulate([{ ms: 3500, eyes: 0.8 }, { ms: 500 }]))).toEqual(['PAUSE']);
  });

  it('works with their measured ~0.81 closed-eye score (below 1.0)', () => {
    expect(types(simulate([{ ms: 1200, eyes: 0.81 }, { ms: 300 }]))).toEqual(['SELECT']);
  });
});

describe('expression guard (laughing / talking)', () => {
  // Build frames with mouth values on top of a pose.
  function simulateMouth(segments, config = { settings, calibration }) {
    let state = createEngineState(config.settings.gestureMap);
    const events = [];
    const guarded = [];
    let t = 0;
    for (const { ms, smile = 0, jaw = 0, ...pose } of segments) {
      for (const end = t + ms; t < end; t += FRAME_MS) {
        const f = frame(t, pose);
        f.blendshapes = { ...f.blendshapes, mouthSmileLeft: smile, mouthSmileRight: smile, jawOpen: jaw };
        const out = stepEngine(state, f, config);
        state = out.state;
        events.push(...out.events);
        guarded.push(out.guarded);
      }
    }
    return { events, guarded };
  }

  it('ignores a head turn while laughing', () => {
    expect(simulateMouth([{ ms: 1500, yaw: 20, smile: 0.8 }]).events).toEqual([]);
  });

  it('ignores a squint-close while laughing (would look like a long blink)', () => {
    expect(simulateMouth([{ ms: 1500, eyes: 0.8, smile: 0.8 }, { ms: 300, smile: 0.8 }]).events).toEqual([]);
  });

  it('ignores movement while talking (jaw open)', () => {
    expect(simulateMouth([{ ms: 1500, yaw: 20, jaw: 0.3 }]).events).toEqual([]);
  });

  it('keeps ignoring for tailMs after the laugh ends', () => {
    // laugh stops, the user is still turned: the hold may only start after the 1s tail
    const { events } = simulateMouth([{ ms: 500, smile: 0.8 }, { ms: 2000, yaw: 20 }]);
    expect(types(events)).toEqual(['LEFT']);
    expect(events[0].t).toBeGreaterThanOrEqual(500 + 1000 + 600 - FRAME_MS);
  });

  it('reports guarded=true so the UI can show it', () => {
    expect(simulateMouth([{ ms: 100, smile: 0.8 }]).guarded.every(Boolean)).toBe(true);
  });

  it('a mapped smile gesture is not blocked by its own smile', () => {
    const config = {
      settings: { ...settings, gestureMap: { SELECT: 'smile' } },
      calibration,
    };
    expect(types(simulateMouth([{ ms: 800, smile: 0.8 }], config).events)).toEqual(['SELECT']);
  });

  it('can be switched off in settings', () => {
    const config = {
      settings: { ...settings, expressionGuard: { ...settings.expressionGuard, enabled: false } },
      calibration,
    };
    expect(types(simulateMouth([{ ms: 700, yaw: 20, smile: 0.8 }], config).events)).toEqual(['LEFT']);
  });
});

describe('pause', () => {
  /** Run segments, optionally from a given state. Returns events, final state, paused per frame. */
  function run(segments, state = createEngineState(settings.gestureMap), start = 0) {
    const events = [];
    let paused;
    let t = start;
    for (const { ms, ...pose } of segments) {
      for (const end = t + ms; t < end; t += FRAME_MS) {
        const out = stepEngine(state, frame(t, pose), { settings, calibration });
        state = out.state;
        paused = out.paused;
        events.push(...out.events);
      }
    }
    return { events, state, paused, t };
  }

  it('eyes closed 3s pauses', () => {
    const r = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }]);
    expect(types(r.events)).toEqual(['PAUSE']);
    expect(r.paused).toBe(true);
  });

  it('while paused, head turns and long blinks are ignored', () => {
    const p = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }]);
    const r = run([{ ms: 1000, yaw: 20 }, { ms: 500 }, { ms: 1500, eyes: 0.8 }, { ms: 500 }], p.state, p.t);
    expect(r.events).toEqual([]);
    expect(r.paused).toBe(true);
  });

  it('eyes closed 3s again resumes', () => {
    const p = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }]);
    const r = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }], p.state, p.t);
    expect(types(r.events)).toEqual(['PAUSE']);
    expect(r.paused).toBe(false);
  });

  it('keeping the eyes closed a long time pauses only once (no flip-flop)', () => {
    const r = run([{ ms: 8000, eyes: 0.8 }, { ms: 500 }]);
    expect(types(r.events)).toEqual(['PAUSE']);
    expect(r.paused).toBe(true);
  });

  it('after resuming, eyes kept closed a bit longer do NOT become a SELECT', () => {
    const p = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }]);
    // resume at ~3s, the user keeps their eyes closed 1.5s more, then opens them
    const r = run([{ ms: 4500, eyes: 0.8 }, { ms: 500 }], p.state, p.t);
    expect(types(r.events)).toEqual(['PAUSE']);
  });

  it('after resuming, normal gestures work again', () => {
    const p = run([{ ms: 3500, eyes: 0.8 }, { ms: 500 }, { ms: 3500, eyes: 0.8 }, { ms: 500 }]);
    expect(p.paused).toBe(false);
    const r = run([{ ms: 700, yaw: 20 }], p.state, p.t);
    expect(types(r.events)).toEqual(['LEFT']);
  });

  it('setPaused (P key) pauses and resumes', () => {
    const s = setPaused(createEngineState(settings.gestureMap), true);
    expect(run([{ ms: 1000, yaw: 20 }], s).events).toEqual([]);
    const resumed = setPaused(s, false);
    // disarmed until neutral, so first return to centre, then turn
    expect(types(run([{ ms: 100 }, { ms: 700, yaw: 20 }], resumed).events)).toEqual(['LEFT']);
  });

  it('setPaused: a turn already held when resuming does not fire', () => {
    const resumed = setPaused(setPaused(createEngineState(settings.gestureMap), true), false);
    expect(run([{ ms: 2000, yaw: 20 }], resumed).events).toEqual([]);
  });

  it('createEngineState can keep the pause state across a reset', () => {
    expect(createEngineState(settings.gestureMap, { paused: true }).paused).toBe(true);
  });
});

describe('eye gestures need a still head', () => {
  // Only the eye gesture is mapped, so any event can only come from it.
  const eyeSettings = { ...settings, gestureMap: { LEFT: 'eyesLeft' } };
  // Eyes looking left (that eye out, other eye in) at full range 0.6, plus a head yaw.
  const eyeFrame = (t, yaw) => ({
    t, faceFound: true, yaw, pitch: 0, roll: 0,
    blendshapes: { eyeLookOutLeft: 0.6, eyeLookInRight: 0.6 },
  });
  function run(yaw, ms = 1000) {
    let state = createEngineState(eyeSettings.gestureMap);
    const events = [];
    for (let t = 0; t < ms; t += FRAME_MS) {
      const out = stepEngine(state, eyeFrame(t, yaw), { settings: eyeSettings, calibration });
      state = out.state;
      events.push(...out.events.map((e) => e.type));
    }
    return events;
  }

  it('looking left with the head still fires LEFT', () => {
    expect(run(0)).toEqual(['LEFT']);
  });

  it('a turned head (eyes counter-rotating to watch the screen) does not', () => {
    expect(run(-15)).toEqual([]); // 15° right = 0.75 of the 20° range > 0.5
    expect(run(12)).toEqual([]);
  });

  it('a small natural head offset is fine', () => {
    expect(run(5)).toEqual(['LEFT']); // 0.25 of range
  });

  it('head gestures and blinks are not affected', () => {
    expect(types(simulate([{ ms: 700, yaw: 20 }]))).toEqual(['LEFT']);
  });
});

describe('configuration', () => {
  it('ignores events mapped to null', () => {
    const state = createEngineState({ LEFT: 'headLeft', UP: null, DOWN: null });
    expect(Object.keys(state.slots)).toEqual(['LEFT']);
  });

  it('uses whatever gesture the caregiver mapped (e.g. eyes up = SELECT)', () => {
    const custom = {
      settings: { ...settings, gestureMap: { SELECT: 'headUp' } },
      calibration,
    };
    expect(types(simulate([{ ms: 700, pitch: 15 }], { config: custom }))).toEqual(['SELECT']);
  });

  it('is pure: does not mutate the previous state', () => {
    const state = createEngineState(settings.gestureMap);
    const snapshot = JSON.stringify(state);
    stepEngine(state, frame(0, { yaw: 20 }), { settings, calibration });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('reports hold progress for the UI ring', () => {
    let state = createEngineState(settings.gestureMap);
    let out;
    for (let t = 0; t <= 300; t += FRAME_MS) {
      out = stepEngine(state, frame(t, { yaw: 20 }), { settings, calibration });
      state = out.state;
    }
    expect(out.progress.LEFT).toBeGreaterThan(0.4);
    expect(out.progress.LEFT).toBeLessThan(0.6);
  });
});
