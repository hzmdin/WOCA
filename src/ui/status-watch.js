// When to show the two status banners. Pure functions (time comes from the
// FaceSignals frames), so they are unit-tested without a browser.
//  - face lost:  show after showAfterMs without a face, hide after hideAfterMs with one
//  - break:      after afterMin of active use (face visible, not paused), show
//                for showMs, then start counting again. Pausing resets the count.

export function createFaceLostState() {
  return { show: false, since: null }; // since: when the current opposite streak began
}

/** @returns {{ state, show: boolean }} */
export function stepFaceLost(state, signals, settings) {
  const { showAfterMs, hideAfterMs } = settings.faceLost;
  const t = signals.t;
  // A streak that would flip the banner: lost while hidden, or found while shown.
  const flipping = state.show ? signals.faceFound : !signals.faceFound;
  if (!flipping) return { state: { show: state.show, since: null }, show: state.show };
  const since = state.since ?? t;
  const needed = state.show ? hideAfterMs : showAfterMs;
  if (t - since >= needed) return { state: { show: !state.show, since: null }, show: !state.show };
  return { state: { show: state.show, since }, show: state.show };
}

export function createBreakState() {
  return { activeMs: 0, lastT: null, showingSince: null };
}

/**
 * @param status { paused: boolean, faceFound: boolean }
 * @returns {{ state, show: boolean }}
 */
export function stepBreak(state, t, { paused, faceFound }, settings) {
  const { afterMin, showMs } = settings.breakReminder;
  if (paused) return { state: { activeMs: 0, lastT: t, showingSince: null }, show: false };

  if (state.showingSince !== null) {
    if (t - state.showingSince >= showMs) return { state: { activeMs: 0, lastT: t, showingSince: null }, show: false };
    return { state: { ...state, lastT: t }, show: true };
  }

  // Count only time the user is actually using it (face visible). Cap the step so a
  // stalled tab (laptop asleep) doesn't jump the count.
  const dt = state.lastT === null ? 0 : Math.min(1000, Math.max(0, t - state.lastT));
  const activeMs = state.activeMs + (faceFound ? dt : 0);
  if (activeMs >= afterMin * 60000) return { state: { activeMs, lastT: t, showingSince: t }, show: true };
  return { state: { activeMs, lastT: t, showingSince: null }, show: false };
}
