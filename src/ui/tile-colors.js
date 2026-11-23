// Which colour a tile gets. The colour is only a second clue next to the big
// label and icon (never the only one), so colour-blind viewers lose nothing.
// Palette (see style.css) is the Okabe-Ito set, chosen to stay distinguishable
// with the common kinds of colour blindness. Yellow is NOT used here: it is
// the highlight colour. Same colour = same meaning on every screen.
//
// Pure (no DOM): tileColor(tile, boardId) → colour key, or null for none.

// One colour per speller letter group, like coloured pens on an E-Tran board.
export const GROUP_COLORS = Object.freeze(['sky', 'orange', 'green', 'purple', 'blue']);

/**
 * @param tile    a board tile or a speller tile
 * @param boardId id of the board it is on ('home', 'needs', …); null in the speller
 * @param group   speller only: index of the open letter group (its letters share its colour)
 */
export function tileColor(tile, boardId = null, group = null) {
  if (tile.color) return tile.color; // the caregiver may set one explicitly
  if (tile.alert) return 'red'; // the only red on screen: never confuse it with anything else
  if (tile.back) return 'grey';
  if (tile.letter !== undefined && group !== null) return GROUP_COLORS[group] ?? null;
  if (tile.group !== undefined) return GROUP_COLORS[tile.group] ?? null;
  if (tile.act === 'speak') return 'green';
  if (tile.act || tile.actions || tile.suggest || tile.word) return 'grey';
  if (tile.speller) return 'blue';
  if (tile.goto) return 'sky';
  if (tile.say) return boardId === 'home' ? 'purple' : 'green'; // Home speaks feelings, other boards needs
  return null;
}

/** Yes/No halves: blue and orange stay apart for everyone (not red/green). */
export function yesNoColor(index, yesSide = 'left') {
  const isYes = (index === 0) === (yesSide !== 'right');
  return isYes ? 'blue' : 'orange';
}
