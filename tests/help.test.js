// Call for help: the most important safety feature. These tests guard the
// AGENTS.md rule "never silence or break the Call for help alert".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHelpAlarm } from '../src/speech/help-alarm.js';
import { ALARM_MS } from '../src/speech/chime.js';
import { createEngineState, stepEngine, setPaused } from '../src/gestures/gesture-engine.js';
import { createBoardState, boardStep, tilesOf } from '../src/ui/board-controller.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';

describe('help alarm loop', () => {
  let deps;
  beforeEach(() => {
    vi.useFakeTimers();
    deps = { alarm: vi.fn(), speak: vi.fn(), stopSpeech: vi.fn(), getRepeatMs: () => 6000 };
  });
  afterEach(() => vi.useRealTimers());

  it('sounds the alarm at once, then speaks the call', () => {
    const help = createHelpAlarm(deps);
    help.start();
    expect(help.isActive()).toBe(true);
    expect(deps.alarm).toHaveBeenCalledTimes(1);
    expect(deps.speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ALARM_MS);
    expect(deps.speak).toHaveBeenCalledTimes(1);
  });

  it('keeps repeating until dismissed (a minute → 11 alarms)', () => {
    const help = createHelpAlarm(deps);
    help.start();
    vi.advanceTimersByTime(60000);
    expect(deps.alarm).toHaveBeenCalledTimes(11); // t = 0, 6, 12, … 60 s
    expect(help.isActive()).toBe(true);
  });

  it('dismiss stops everything, including a pending spoken call', () => {
    const help = createHelpAlarm(deps);
    help.start();
    help.dismiss();
    vi.advanceTimersByTime(60000);
    expect(deps.alarm).toHaveBeenCalledTimes(1);
    expect(deps.speak).not.toHaveBeenCalled();
    expect(deps.stopSpeech).toHaveBeenCalled();
    expect(help.isActive()).toBe(false);
  });

  it('starting twice does not create a double alarm', () => {
    const help = createHelpAlarm(deps);
    help.start();
    help.start();
    vi.advanceTimersByTime(6000);
    expect(deps.alarm).toHaveBeenCalledTimes(2); // not 4
  });

  it('can be started again after being dismissed', () => {
    const help = createHelpAlarm(deps);
    help.start();
    help.dismiss();
    help.start();
    expect(help.isActive()).toBe(true);
  });

  it('has no way for a gesture to stop it (only start / dismiss / isActive)', () => {
    expect(Object.keys(createHelpAlarm(deps)).sort()).toEqual(['dismiss', 'isActive', 'start']);
  });
});

describe('help from the Home board', () => {
  it('"Tolong!" is the last Home tile: one LEFT (wraps) + SELECT raises the alert', () => {
    const home = tilesOf(DEFAULT_BOARDS, 'home');
    expect(home.at(-1)).toMatchObject({ label: 'Tolong!', alert: true });
    let state = createBoardState();
    state = boardStep(state, 'LEFT', DEFAULT_BOARDS).state;
    expect(boardStep(state, 'SELECT', DEFAULT_BOARDS).action).toEqual({ type: 'alert' });
  });
});

describe('HELP gesture (when the caregiver maps one)', () => {
  const settings = { ...DEFAULT_SETTINGS, gestureMap: { ...DEFAULT_SETTINGS.gestureMap, HELP: 'headUp' } };
  const config = { settings, calibration: DEFAULT_CALIBRATION };
  const frame = (t, pitch) => ({ t, faceFound: true, yaw: 0, pitch, roll: 0, blendshapes: {} });

  function run(ms, pitch, state = createEngineState(settings.gestureMap)) {
    const events = [];
    for (let t = 0; t < ms; t += 33) {
      const out = stepEngine(state, frame(t, pitch), config);
      state = out.state;
      events.push(...out.events.map((e) => e.type));
    }
    return events;
  }

  it('needs the longer 2s hold (a normal 0.6–1.5s hold is not enough)', () => {
    expect(run(1500, 15)).toEqual([]);
    expect(run(2200, 15)).toEqual(['HELP']);
  });

  it('works even while paused', () => {
    const paused = setPaused(createEngineState(settings.gestureMap), true);
    // disarmed until neutral, then a 2s chin-up hold
    let state = paused;
    const events = [];
    let t = 0;
    for (const [ms, pitch] of [[200, 0], [2200, 15]]) {
      for (const end = t + ms; t < end; t += 33) {
        const out = stepEngine(state, frame(t, pitch), config);
        state = out.state;
        events.push(...out.events.map((e) => e.type));
      }
    }
    expect(events).toEqual(['HELP']);
    expect(state.paused).toBe(true); // help does not un-pause
  });

  it('is off by default (no gesture guessed before Phase 0)', () => {
    expect(DEFAULT_SETTINGS.gestureMap.HELP).toBeNull();
    expect(DEFAULT_SETTINGS.eventHoldMs.HELP).toBeGreaterThanOrEqual(2000);
  });
});
