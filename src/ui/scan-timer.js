// Auto-scan timing: the highlight moves to the next tile by itself and the
// user only has to SELECT (one gesture instead of several).
// Safety first (AGENTS.md principle 1): the highlight never moves while
// SELECT is being held, while input is not live (paused, face lost, blocked,
// a phrase being spoken), and every new screen gets extra time before the
// first move so the user can see where they are.
//
// Pure (no DOM, no timers): scanStep(state, input, options) → { state, advance }
//   input   { now, live, holding, screen, index }  (now in ms)
//   options { stepMs, startExtraMs } from settings.scan

export function createScanState() {
  return { screen: null, index: null, dueAt: null };
}

export function scanStep(state, { now, live, holding, screen, index }, { stepMs, startExtraMs }) {
  // Not live: forget the schedule; on return the user gets a fresh, longer first step.
  if (!live) return { state: { screen, index, dueAt: null }, advance: false };
  // Mid-hold: keep the tile still and restart its dwell time.
  if (holding) return { state: { screen, index, dueAt: now + stepMs }, advance: false };
  if (state.dueAt === null || state.screen !== screen) {
    return { state: { screen, index, dueAt: now + stepMs + startExtraMs }, advance: false };
  }
  // The highlight moved some other way (caregiver keys): give the new tile its full time.
  if (state.index !== index) return { state: { screen, index, dueAt: now + stepMs }, advance: false };
  if (now >= state.dueAt) return { state: { screen, index, dueAt: now + stepMs }, advance: true };
  return { state, advance: false };
}
