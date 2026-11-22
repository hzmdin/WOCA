// Records FaceSignals frames into a JSON "fixture" for regression tests.
// Numbers only (angles + blendshape scores): never video or images.
// Pure: no DOM, no timers; the UI feeds frames in and saves the result.

export const FIXTURE_VERSION = 1;
export const RECORD_MS = 10000;

/** Labels the developer can record, with what to do. Tests (task 2.3) key off these. */
export const RECORDING_LABELS = Object.freeze({
  neutral: 'Rest normally, look at the screen. Small natural movements are fine.',
  headLeft: 'Turn head to YOUR left and hold ~1s, back to centre. Repeat 3 times.',
  headRight: 'Turn head to YOUR right and hold ~1s, back to centre. Repeat 3 times.',
  headUp: 'Chin up and hold ~1s, back to centre. Repeat 3 times.',
  headDown: 'Chin down and hold ~1s, back to centre. Repeat 3 times.',
  eyesLeft: 'Head still; look left with eyes only ~1s, back. Repeat 3 times.',
  eyesRight: 'Head still; look right with eyes only ~1s, back. Repeat 3 times.',
  eyesUp: 'Head still; look UP with eyes only ~1s, back to the screen. Repeat 3 times.',
  eyesDown: 'Head still; look DOWN with eyes only ~1s (eyes open!), back. Repeat 3 times.',
  longBlink: 'Close eyes ~1.5s, open, wait 2s. Repeat 3 times.',
  eyesClosed3s: 'Rest 2s, close eyes ~4s, open, rest.',
  blinks: 'Blink normally and often (quick blinks only).',
  laugh: 'Laugh naturally (watch something funny). Must NOT trigger anything.',
  talk: 'Talk or mouth words, nod along like in conversation.',
  smile: 'Smile big, relax, repeat a few times.',
  faceLost: 'Cover the camera / move out of frame a few times.',
});

const round = (v, digits) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Compact one frame: time relative to start, rounded values (keeps files small). */
export function compactFrame(signals, startT) {
  const blendshapes = {};
  for (const [k, v] of Object.entries(signals.blendshapes)) blendshapes[k] = round(v, 3);
  return {
    t: Math.round(signals.t - startT),
    faceFound: signals.faceFound,
    yaw: round(signals.yaw, 2),
    pitch: round(signals.pitch, 2),
    roll: round(signals.roll, 2),
    blendshapes,
  };
}

/** Start a recording. Call add(signals) every frame; it returns false once full. */
export function createRecording(label, { durationMs = RECORD_MS, now = () => new Date() } = {}) {
  if (!RECORDING_LABELS[label]) throw new Error(`unknown recording label: ${label}`);
  const frames = [];
  let startT = null;

  return {
    label,
    /** @returns true while still recording */
    add(signals) {
      if (startT === null) startT = signals.t;
      if (signals.t - startT >= durationMs) return false;
      frames.push(compactFrame(signals, startT));
      return true;
    },
    elapsedMs() {
      return frames.length ? frames[frames.length - 1].t : 0;
    },
    finish() {
      const recordedAt = now().toISOString();
      return {
        version: FIXTURE_VERSION,
        label,
        recordedAt,
        durationMs: this.elapsedMs(),
        frameCount: frames.length,
        frames,
      };
    },
  };
}

/** File name like "laugh-2026-11-22T15-04-05.json" (no colons: Windows-safe). */
export function fixtureFileName(fixture) {
  const stamp = fixture.recordedAt.slice(0, 19).replace(/:/g, '-');
  return `${fixture.label}-${stamp}.json`;
}
