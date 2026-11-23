// Audio scan: while the highlight moves, the app SAYS the highlighted tile, so
// the user does not need to see the screen well (blurry vision, glare, a screen
// out of the line of sight). They hear the options and select with one gesture.
// Pure (no DOM, no speech): the caller does the speaking.

/** What to say for a tile. A letter group is spelled out ("A, B, C, D, E"). */
export function tileSpeech(tile) {
  if (tile.group !== undefined) return tile.label.trim().split(/\s+/).join(', ');
  // A slash is read aloud as "garis miring"; "atau" (or) is what it means: "Ya atau Tidak".
  return String(tile.label ?? '').trim().replace(/\s*\/\s*/g, ' atau ');
}

/**
 * Decide whether to announce the highlighted tile now.
 * Announce each time the highlight lands on something new (a move, or a new
 * screen). Not while input isn't live; when it becomes live again, announce the
 * current tile once more so the user hears where they are.
 * @param lastKey the key announced last (null = nothing yet)
 * @param input   { enabled, live, key }  key = screen + highlighted index
 * @returns { lastKey, announce }
 */
export function announceStep(lastKey, { enabled, live, key }) {
  if (!enabled || !live) return { lastKey: null, announce: false };
  if (key === lastKey) return { lastKey, announce: false };
  return { lastKey: key, announce: true };
}
