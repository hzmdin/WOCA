// The heart of WOCA: FaceSignals frames -> discrete GestureEvents.
// Pure and deterministic: stepEngine(state, signals, config) returns a NEW
// state plus events, so it is tested frame by frame without a camera.
//
// Safety rules (AGENTS.md: "when unsure, ignore the input"):
//  - a gesture must pass thresholdPct, then be HELD (hysteresis down to releasePct)
//  - after it fires, the user must return to neutral (< releasePct) before it can fire again
//  - a global cooldown after any event blocks rapid double-fires
//  - face lost -> every timer resets, nothing fires
//  - laughing/talking (expression guard) -> same as face lost, plus a tail
//  - paused -> only PAUSE (so the user can resume) and HELP (the user may need help
//    most when resting) are watched
//  - settings.eventHoldMs can require a longer hold for an event (HELP: 2s)
//  - eye-direction gestures are ignored while the head is turned
//  - pausing or resuming disarms every gesture until the user returns to neutral,
//    so eyes still closed after a pause can't turn into a SELECT
import { GESTURES, HEAD_KEYS, activationFor } from './gesture-definitions.js';

/**
 * @param gestureMap e.g. { LEFT: 'headLeft', SELECT: 'longBlink', UP: null }
 * @param opts { paused } carry the pause state over when the engine is reset
 */
export function createEngineState(gestureMap, { paused = false } = {}) {
  const slots = {};
  for (const [eventType, gesture] of Object.entries(gestureMap)) {
    if (gesture && GESTURES[gesture]) slots[eventType] = { heldSince: null, armed: true };
  }
  return { slots, cooldownUntil: -Infinity, guardUntil: -Infinity, paused };
}

const disarmAll = (slots) =>
  Object.fromEntries(Object.entries(slots).map(([type, s]) => [type, { ...s, heldSince: null, armed: false }]));

/** Pause/resume from outside (caregiver's P key). Same safety as the gesture. */
export function setPaused(state, paused) {
  return { ...state, paused, slots: disarmAll(state.slots) };
}

/**
 * Is the mouth active enough that head/eye movement can't be trusted?
 * If the caregiver mapped `smile` (or `mouthOpen`) as a gesture, that movement
 * must not block itself, so only the other part of the guard applies.
 * Thresholds come from calibration (the user's resting mouth) when available.
 */
export function mouthActive(signals, settings, calibration) {
  const g = settings.expressionGuard;
  if (!g?.enabled) return false;
  const th = calibration?.guard ?? g;
  const b = signals.blendshapes;
  const mapped = Object.values(settings.gestureMap);
  const smileMapped = mapped.includes('smile');
  const jawMapped = mapped.includes('mouthOpen');
  const smile = ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2;
  return (!smileMapped && smile >= th.smile) || (!jawMapped && (b.jawOpen ?? 0) >= th.jawOpen);
}

const resetHolds = (slots) =>
  Object.fromEntries(Object.entries(slots).map(([type, s]) => [type, { ...s, heldSince: null }]));

/**
 * @param state   from createEngineState / previous step
 * @param signals one FaceSignals frame
 * @param config  { settings, calibration }
 * @returns {{ state, events: {type, t}[], progress: Record<string, number>,
 *            activations: Record<string, number>, guarded: boolean, paused: boolean }}
 *   A PAUSE event toggles state.paused; read `paused` to know which way.
 */
export function stepEngine(state, signals, { settings, calibration }) {
  const t = signals.t;
  const slots = {};
  const events = [];
  const progress = {};
  const activations = {};
  let cooldownUntil = state.cooldownUntil;
  let guardUntil = state.guardUntil ?? -Infinity;
  let paused = state.paused ?? false;

  if (!signals.faceFound) {
    return {
      state: { slots: resetHolds(state.slots), cooldownUntil, guardUntil, paused },
      events, progress, activations, guarded: false, paused,
    };
  }

  if (mouthActive(signals, settings, calibration)) guardUntil = t + settings.expressionGuard.tailMs;
  if (t < guardUntil) {
    return {
      state: { slots: resetHolds(state.slots), cooldownUntil, guardUntil, paused },
      events, progress, activations, guarded: true, paused,
    };
  }

  const headTurned = HEAD_KEYS.some((k) => activationFor(k, signals, calibration) >= settings.eyeGestureMaxHeadPct);

  for (const [type, prev] of Object.entries(state.slots)) {
    if ((paused && type !== 'PAUSE' && type !== 'HELP') || (headTurned && GESTURES[settings.gestureMap[type]].eyeDirection)) {
      slots[type] = { ...prev, heldSince: null };
      continue;
    }
    const gesture = GESTURES[settings.gestureMap[type]];
    const a = gesture.activation(signals, calibration);
    activations[type] = a;
    const slot = { ...prev };
    slots[type] = slot;

    if (!slot.armed) {
      // Already fired: wait for a return to neutral before re-arming.
      if (a < settings.releasePct) slot.armed = true;
      continue;
    }

    const holding = slot.heldSince !== null;
    const startAt = gesture.thresholdPct ? gesture.thresholdPct(settings) : settings.thresholdPct;
    const active = holding ? a >= settings.releasePct : a >= startAt;

    if (active) {
      if (!holding) slot.heldSince = t;
      const held = t - slot.heldSince;

      if (gesture.kind === 'hold') {
        const holdFor =
          settings.eventHoldMs?.[type] ?? (gesture.holdMs ? gesture.holdMs(settings) : settings.holdMs);
        progress[type] = Math.min(1, held / holdFor);
        if (held >= holdFor && t >= cooldownUntil) {
          events.push({ type, t });
          cooldownUntil = t + settings.cooldownMs;
          slot.heldSince = null;
          slot.armed = false;
        }
      } else {
        // 'release' kind: show progress toward minMs; it fires on release.
        const max = gesture.maxMs(settings);
        progress[type] = held >= max ? 0 : Math.min(1, held / gesture.minMs(settings));
      }
    } else if (holding) {
      // Released.
      const held = t - slot.heldSince;
      slot.heldSince = null;
      if (
        gesture.kind === 'release' &&
        held >= gesture.minMs(settings) &&
        held < gesture.maxMs(settings) &&
        t >= cooldownUntil
      ) {
        events.push({ type, t });
        cooldownUntil = t + settings.cooldownMs;
      }
    }
  }

  let outSlots = slots;
  if (events.some((e) => e.type === 'PAUSE')) {
    paused = !paused;
    outSlots = disarmAll(slots);
  }

  return {
    state: { slots: outSlots, cooldownUntil, guardUntil, paused },
    events, progress, activations, guarded: false, paused,
  };
}
