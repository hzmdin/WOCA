// Every tunable number lives here (see AGENTS.md). The settings screen will
// override these per user; the gesture engine must never hard-code values.

// Raw gesture names the engine will be able to detect. Which one maps to which
// event is decided per user in calibration, because the user's best gestures are
// not known yet.
export const AVAILABLE_GESTURES = Object.freeze([
  'headLeft',
  'headRight',
  'headUp',
  'headDown',
  'eyesLeft',
  'eyesRight',
  'eyesUp',
  'eyesDown',
  'longBlink',
  'eyesClosed3s',
  'smile', // opt-in only: the user laughs naturally, so never a default SELECT
]);

export const DEFAULT_SETTINGS = Object.freeze({
  // Default = eye gestures (chosen by the developer, verified on recordings).
  // Eye gestures REQUIRE calibration: uncalibrated, the user's resting eye offset can
  // look like "look left". Look down is avoided: it overlaps with blinking.
  gestureMap: Object.freeze({
    LEFT: 'eyesLeft',
    RIGHT: 'eyesRight',
    UP: 'eyesUp', // "Tukar baris": with ≤2 rows, one row-switch gesture is enough
    DOWN: null,
    SELECT: 'longBlink',
    BACK: null,
    PAUSE: 'eyesClosed3s',
    // Call for help from ANY screen, even while paused. Off until Phase 0
    // shows which movement the user does reliably; the Home "Tolong" tile works anyway.
    HELP: null,
  }),
  // Events that need a longer hold than holdMs (harder to trigger by accident).
  eventHoldMs: Object.freeze({ HELP: 2000 }),
  help: Object.freeze({
    repeatMs: 6000, // alarm + spoken call repeats this often until dismissed
    volume: 0.5, // alarm tone loudness 0..1 (chime is 0.15)
  }),
  // Activation = how far the user moved as a fraction of their calibrated range.
  thresholdPct: 0.6, // must reach this to START holding
  // Eyes-closed gestures (long blink, 3 s pause) need the eyes ALMOST fully
  // closed: looking down half-closes the eyelids (developer: blink ~0.58 looking
  // down vs ~0.77 really closed) and must not count as a long blink.
  closedThresholdPct: 0.85,
  releasePct: 0.3, // must drop below this to count as "back to neutral"
  holdMs: 600,
  // Eye-direction gestures only count while the head is still and near rest:
  // when the head turns but the user keeps watching the screen, the eyes rotate the
  // other way (a natural reflex) and look like a deliberate "look left/right"
  // (seen in the headRight recording). Fraction of the calibrated head range.
  eyeGestureMaxHeadPct: 0.5,
  cooldownMs: 800,
  longBlinkMs: 1000, // eyes closed at least this long, then opened = longBlink
  pauseHoldMs: 3000, // eyes closed this long = eyesClosed3s (longBlink cancelled)
  // Laughing/talking moves the head and squints the eyes, which looks like real
  // gestures (seen in recorded fixtures). While the mouth is active, ignore all
  // input, and keep ignoring it for tailMs afterwards. Raw blendshape scores
  // (0..1); calibration should raise these above the user's resting mouth values.
  expressionGuard: Object.freeze({
    enabled: true,
    smile: 0.3, // avg mouthSmileLeft/Right; developer: neutral 0.00, laugh ~0.82
    jawOpen: 0.15, // developer: neutral 0.00, talking p90 ~0.29
    tailMs: 1000,
  }),
  scanMode: false,
  scanIntervalMs: 1500,
  voice: Object.freeze({ name: null, rate: 0.9, lang: 'ms-MY' }),
  board: Object.freeze({
    returnHomeMs: 3000, // after a phrase is spoken, go back to Home
    maxTiles: 6, // per board, including the automatic back tile
    yesSide: 'left', // Yes/No mode: head turn to the USER'S left = "Ya" (or 'right')
  }),
  speller: Object.freeze({
    suggestions: 3, // words offered in "Cadangan" (with Aksi + Kembali = max 5 tiles)
    minPrefix: 1, // letters typed before suggesting
    historyMax: 500, // learned words kept (least used are dropped)
  }),
  // "Wajah tidak kelihatan" banner: wait a moment before showing (no flicker on
  // quick movements), hide quickly when the user's face is back.
  faceLost: Object.freeze({ showAfterMs: 1000, hideAfterMs: 300 }),
  // Gentle "take a break?" banner after this much active (unpaused) use.
  breakReminder: Object.freeze({ afterMin: 15, showMs: 10000 }),
  // Re-centre (key C) after the bed angle changes: re-measure only the user's resting
  // head pose and resting eye direction; ranges and mouth guard are kept.
  recentre: Object.freeze({
    durationMs: 2000,
    maxSpreadDeg: 6, // head must stay this still (yaw/pitch spread) while measuring
    driftMs: 10000, // head held off-centre this long with no gesture -> suggest re-centre
  }),
  calibration: Object.freeze({
    countdownMs: 3000, // get ready before each step
    restMs: 5000, // "rest and look at the screen"
    gestureMs: 10000, // "do it 3 times"
    minRange: Object.freeze({ head: 5, score: 0.1 }), // smaller = "couldn't detect"
    minReps: 2, // repetitions that must be seen in a gesture step
    guardMargin: Object.freeze({ smile: 0.15, jawOpen: 0.1 }), // above the user's resting mouth
  }),
});

// Used until the calibration wizard (task 2.4) measures the user's own values.
// `neutral` = resting head pose (degrees). `baseline` = resting value of each
// eye/face measure. `ranges` = how far each movement typically goes from rest
// at full effort (degrees for head, 0..1 score for eyes/face).
// `guard` = expression-guard thresholds measured from the user's resting mouth
// (null = use settings.expressionGuard).
export const DEFAULT_CALIBRATION = Object.freeze({
  version: 2,
  neutral: Object.freeze({ yaw: 0, pitch: 0, roll: 0 }),
  baseline: Object.freeze({
    eyesLeft: 0, eyesRight: 0, eyesUp: 0, eyesDown: 0, eyesClosed: 0, smile: 0,
  }),
  guard: null,
  ranges: Object.freeze({
    headLeft: 20,
    headRight: 20,
    headUp: 15,
    headDown: 15,
    eyesLeft: 0.6,
    eyesRight: 0.6,
    eyesUp: 0.5,
    eyesDown: 0.5,
    eyesClosed: 0.75, // a developer's closed eyes measured ~0.81
    smile: 0.6,
  }),
  createdAt: null,
});
