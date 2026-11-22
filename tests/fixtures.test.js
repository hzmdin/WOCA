// Regression tests from REAL recorded faces (tests/fixtures/*.json, task 2.2).
// Every fixture is replayed through the gesture engine and must produce the
// expected events, for two setups:
//   1. head-turn setup (HEAD_SETTINGS), uncalibrated and calibrated
//   2. the DEFAULT setup (eyes: look left/right, look up = switch row,
//      long blink = select), calibrated from the neutral recording
// Add a new recording -> it is tested automatically. A new label must get an
// entry in EXPECTED (head setup) below.
import { describe, it, expect } from 'vitest';
import { loadFixtures, replay } from './helpers/replay.js';
import { RECORDING_LABELS, FIXTURE_VERSION } from '../src/vision/recorder.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';
import { analyzeRest, analyzeGesture, buildCalibration } from '../src/gestures/calibration.js';
import { HEAD_SETTINGS } from './helpers/settings.js';

// none: no events at all. Otherwise: only events of type `only`, at least `min`.
// (People do 3-5 repetitions when recording, so movement counts are not exact.)
const NONE = { none: true };
const EXPECTED = {
  neutral: NONE,
  blinks: NONE, // quick natural blinks must never SELECT
  laugh: NONE, // THE safety test: laughing must not trigger anything
  talk: NONE,
  smile: NONE,
  faceLost: NONE, // never act on partial data
  longBlink: { only: 'SELECT', min: 2 },
  eyesClosed3s: { only: 'PAUSE', min: 1 },
  headLeft: { only: 'LEFT', min: 2 },
  headRight: { only: 'RIGHT', min: 2 },
  eyesLeft: NONE, // not mapped in the head-turn setup
  eyesRight: NONE,
  eyesUp: NONE,
  eyesDown: NONE, // and above all: looking down must never become a SELECT (long blink)
};

const fixtures = loadFixtures();
const byLabel = Object.fromEntries(fixtures.map((f) => [f.fixture.label, f.fixture]));
const describeEvents = (events) => events.map((e) => `${e.type}@${e.t}ms`).join(' ') || '(none)';

function check(label, events) {
  const exp = EXPECTED[label];
  const msg = describeEvents(events);
  if (exp.none) {
    expect(events, msg).toEqual([]);
  } else {
    expect(events.every((e) => e.type === exp.only), msg).toBe(true);
    expect(events.length, msg).toBeGreaterThanOrEqual(exp.min);
  }
}

// Calibration built from the developer's own recordings, as the wizard would.
function calibrateFromFixtures() {
  const rest = analyzeRest(byLabel.neutral.frames, HEAD_SETTINGS);
  const results = {};
  for (const [key, label] of [['headLeft', 'headLeft'], ['headRight', 'headRight'], ['eyesClosed', 'longBlink']]) {
    if (byLabel[label]) results[key] = analyzeGesture(key, byLabel[label].frames, rest, HEAD_SETTINGS);
  }
  return buildCalibration(rest, results, DEFAULT_CALIBRATION);
}

describe('recorded fixtures: head-turn setup', () => {
  it('exist (task 2.2 requires at least 6)', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(6);
  });

  const configs = [['default calibration', () => DEFAULT_CALIBRATION]];
  if (byLabel.neutral) configs.push(['calibrated from recordings', calibrateFromFixtures]);

  for (const { file, fixture } of fixtures) {
    describe(file, () => {
      it('is a valid fixture with a known label', () => {
        expect(fixture.version).toBe(FIXTURE_VERSION);
        expect(RECORDING_LABELS[fixture.label]).toBeTruthy();
        expect(fixture.frames.length).toBe(fixture.frameCount);
        expect(EXPECTED[fixture.label], `add "${fixture.label}" to EXPECTED`).toBeDefined();
      });

      for (const [name, getCalibration] of configs) {
        it(`gives ${JSON.stringify(EXPECTED[fixture.label])} with ${name}`, () => {
          check(fixture.label, replay(fixture, { settings: HEAD_SETTINGS, calibration: getCalibration() }));
        });
      }
    });
  }

  // Remind the developer which important recordings are still missing.
  for (const label of ['neutral', 'laugh', 'talk', 'longBlink', 'headLeft', 'headRight', 'eyesClosed3s', 'eyesUp', 'eyesDown']) {
    if (!byLabel[label]) it.todo(`record a "${label}" fixture`);
  }
});

describe('expression guard is what keeps laugh/talk safe', () => {
  const unguarded = {
    settings: { ...HEAD_SETTINGS, expressionGuard: { ...HEAD_SETTINGS.expressionGuard, enabled: false } },
    calibration: DEFAULT_CALIBRATION,
  };

  it.skipIf(!byLabel.laugh)('without the guard, the recorded laugh WOULD trigger events', () => {
    // Documents why the guard exists (the laugh fired LEFT + SELECT before it).
    expect(replay(byLabel.laugh, unguarded).length).toBeGreaterThan(0);
  });
});

// The DEFAULT setup: eyes left/right to move, look up to switch row (UP),
// long blink to select. Every recording must give only its own event; in
// particular eyesDown and eyesUp must not SELECT, and a long blink must not
// count as UP. Eye gestures need calibration: at rest the eyes sit slightly
// to one side (baseline ~0.16), which uncalibrated would read as "look left".
// So this suite calibrates the resting values from the neutral recording first.
describe('recorded fixtures: DEFAULT eye setup, rest-calibrated', () => {
  const calibration = byLabel.neutral
    ? buildCalibration(analyzeRest(byLabel.neutral.frames, DEFAULT_SETTINGS), {}, DEFAULT_CALIBRATION)
    : DEFAULT_CALIBRATION;
  const settings = DEFAULT_SETTINGS;

  it('the defaults really are the eye setup', () => {
    expect(settings.gestureMap).toMatchObject({ LEFT: 'eyesLeft', RIGHT: 'eyesRight', UP: 'eyesUp', DOWN: null, SELECT: 'longBlink' });
  });

  const EYE_EXPECTED = {
    ...EXPECTED,
    headLeft: NONE, // head turns are not mapped in this setup
    headRight: NONE,
    eyesLeft: { only: 'LEFT', min: 2 },
    eyesRight: { only: 'RIGHT', min: 2 },
    eyesUp: { only: 'UP', min: 2 },
    eyesDown: NONE,
  };
  for (const { file, fixture } of fixtures) {
    it(`${file} gives ${JSON.stringify(EYE_EXPECTED[fixture.label])}`, () => {
      const events = replay(fixture, { settings, calibration });
      const exp = EYE_EXPECTED[fixture.label];
      const msg = describeEvents(events);
      if (exp.none) expect(events, msg).toEqual([]);
      else {
        expect(events.every((e) => e.type === exp.only), msg).toBe(true);
        expect(events.length, msg).toBeGreaterThanOrEqual(exp.min);
      }
    });
  }
});

describe('"eyes almost closed" threshold is what keeps look-down from selecting', () => {
  it.skipIf(!byLabel.eyesDown)('with the old 60% threshold, looking down WOULD fire SELECT', () => {
    // Looking down half-closes the eyelids (blink ~0.58) vs a real blink (~0.77).
    const old = { settings: { ...HEAD_SETTINGS, closedThresholdPct: 0.6 }, calibration: DEFAULT_CALIBRATION };
    expect(replay(byLabel.eyesDown, old).map((e) => e.type)).toContain('SELECT');
  });

  it.skipIf(!byLabel.eyesDown)('with the current threshold it does not, and real long blinks still work', () => {
    const cfg = { settings: HEAD_SETTINGS, calibration: DEFAULT_CALIBRATION };
    expect(replay(byLabel.eyesDown, cfg)).toEqual([]);
    expect(replay(byLabel.longBlink, cfg).filter((e) => e.type === 'SELECT').length).toBeGreaterThanOrEqual(2);
  });
});
