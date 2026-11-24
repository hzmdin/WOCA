import { describe, it, expect } from 'vitest';
import { createEngineState, stepEngine, mouthActive } from '../src/gestures/gesture-engine.js';
import { MEASURES, GESTURES } from '../src/gestures/gesture-definitions.js';
import { calibrationSteps } from '../src/gestures/calibration.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION, AVAILABLE_GESTURES } from '../src/storage/default-settings.js';
import { loadCalibration, isValidCalibration, normalizeCalibration, saveCalibration, STORAGE_KEY } from '../src/storage/calibration-store.js';
import { readBackup, makeBackup } from '../src/storage/backup.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { validateSettings } from '../src/storage/settings-store.js';
import { loadFixtures, replay } from './helpers/replay.js';

const FRAME_MS = 33;
const frame = (t, b = {}) => ({ t, faceFound: true, yaw: 0, pitch: 0, roll: 0, blendshapes: b });
const withMap = (gestureMap) => ({ settings: { ...DEFAULT_SETTINGS, gestureMap }, calibration: DEFAULT_CALIBRATION });

/** Hold a pose for `ms`, then rest 600 ms. Returns event types. */
function run(config, pose, ms = 900) {
  let state = createEngineState(config.settings.gestureMap);
  const types = [];
  let t = 0;
  for (; t < ms + 600; t += FRAME_MS) {
    const out = stepEngine(state, frame(t, t < ms ? pose : {}), config);
    state = out.state;
    types.push(...out.events.map((e) => e.type));
  }
  return types;
}

const BROWS = { browInnerUp: 0.7, browOuterUpLeft: 0.6, browOuterUpRight: 0.6 };

describe('browUp', () => {
  it('measures all three brow parts together; one twitching brow is not enough', () => {
    expect(MEASURES.browUp(frame(0, BROWS))).toBeCloseTo(0.65, 2);
    expect(MEASURES.browUp(frame(0, { browOuterUpLeft: 0.6 }))).toBeLessThan(0.2);
  });

  it('raised eyebrows held past the hold time give SELECT; a flick does not', () => {
    const config = withMap({ SELECT: 'browUp' });
    expect(run(config, BROWS, 900)).toEqual(['SELECT']);
    expect(run(config, BROWS, 250)).toEqual([]);
  });
});

describe('mouthOpen', () => {
  it('an open mouth held past the hold time gives SELECT, and the mouth guard does not block it', () => {
    const config = withMap({ SELECT: 'mouthOpen' });
    expect(run(config, { jawOpen: 0.7 }, 900)).toEqual(['SELECT']);
  });

  it('the guard still ignores an open mouth when mouthOpen is NOT a gesture (head turn example)', () => {
    const config = withMap({ LEFT: 'headLeft' });
    expect(mouthActive(frame(0, { jawOpen: 0.7 }), config.settings, null)).toBe(true);
    expect(mouthActive(frame(0, { jawOpen: 0.7 }), withMap({ SELECT: 'mouthOpen' }).settings, null)).toBe(false);
  });

  it('with mouthOpen mapped, a smile still blocks other gestures', () => {
    const settings = withMap({ SELECT: 'mouthOpen', LEFT: 'headLeft' }).settings;
    expect(mouthActive(frame(0, { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }), settings, null)).toBe(true);
  });
});

describe('fixtures: what the new gestures do on real recordings', () => {
  const fixtures = loadFixtures();
  const eventsFor = (gesture, pick) =>
    fixtures.filter(({ file }) => pick.test(file)).map(({ file, fixture }) => [file, replay(fixture, withMap({ SELECT: gesture }))]);

  it('mouthOpen stays quiet on neutral, blinks and head/eye movements', () => {
    for (const [file, events] of eventsFor('mouthOpen', /^(neutral|blinks|longBlink|eyesClosed3s|head|eyes)/)) {
      expect(events, file).toEqual([]);
    }
  });

  it('browUp stays quiet on every recording (none of them has raised eyebrows)', () => {
    // Recordings made before brow values were kept have no brow data at all, so this
    // mostly guards against browUp firing from missing data. Record new ones to extend it.
    for (const { file, fixture } of fixtures) expect(replay(fixture, withMap({ SELECT: 'browUp' })), file).toEqual([]);
  });
});

describe('settings and calibration', () => {
  it('both gestures are selectable, defined, and give calibration steps', () => {
    for (const g of ['browUp', 'mouthOpen']) {
      expect(AVAILABLE_GESTURES).toContain(g);
      expect(GESTURES[g].rangeKey).toBe(g);
      expect(DEFAULT_CALIBRATION.ranges[g]).toBeGreaterThan(0);
    }
    expect(calibrationSteps({ SELECT: 'browUp' })).toEqual(['rest', 'browUp']);
    expect(calibrationSteps({ SELECT: 'mouthOpen' })).toEqual(['rest', 'mouthOpen']);
    expect(validateSettings({ ...DEFAULT_SETTINGS, gestureMap: { ...DEFAULT_SETTINGS.gestureMap, SELECT: 'browUp' } })).toEqual([]);
  });

  // The calibration saved before these gestures existed must keep working.
  const OLD = (() => {
    const { browUp, mouthOpen, ...ranges } = { ...DEFAULT_CALIBRATION.ranges, headLeft: 27 };
    const { browUp: b1, mouthOpen: b2, ...baseline } = DEFAULT_CALIBRATION.baseline;
    return { ...DEFAULT_CALIBRATION, ranges, baseline, createdAt: '2026-11-22T10:00:00.000Z' };
  })();

  it('an older saved calibration stays valid and keeps the user\'s own values', () => {
    expect(isValidCalibration(OLD)).toBe(true);
    const storage = { data: { [STORAGE_KEY]: JSON.stringify(OLD) }, getItem(k) { return this.data[k] ?? null; } };
    const loaded = loadCalibration(storage);
    expect(loaded.ranges.headLeft).toBe(27);
    expect(loaded.createdAt).toBe(OLD.createdAt);
    expect(loaded.ranges.browUp).toBe(DEFAULT_CALIBRATION.ranges.browUp);
    expect(loaded.baseline.mouthOpen).toBe(0);
  });

  it('still rejects a bad range for the new gestures, and normalising is idempotent', () => {
    expect(isValidCalibration({ ...OLD, ranges: { ...OLD.ranges, browUp: 0 } })).toBe(false);
    const once = normalizeCalibration(OLD);
    expect(normalizeCalibration(once)).toEqual(once);
    expect(saveCalibration(once, { setItem() {} })).toBe(true);
  });

  it('restoring an older backup works and fills the new gestures', () => {
    const text = JSON.stringify(makeBackup({ settings: DEFAULT_SETTINGS, boards: DEFAULT_BOARDS, calibration: OLD }));
    const result = readBackup(text);
    expect(result.ok).toBe(true);
    expect(result.calibration.ranges.browUp).toBe(DEFAULT_CALIBRATION.ranges.browUp);
    expect(result.calibration.ranges.headLeft).toBe(27);
  });
});
