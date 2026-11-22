// Speller ("Eja"), E-Tran style: pick a letter group, then a letter.
// Every level has at most 6 tiles (AGENTS.md: targets of 1/6 of the screen):
//   groups:   ABCDE · FGHIJ · KLMNO · PQRST · UVWYZ · Aksi
//             (the last tile becomes "Cadangan" while there are suggestions)
//   letters:  the 5 letters + Kembali
//   suggest:  up to 3 words + Aksi + Kembali
//   actions:  Sebut · Ruang · Padam · X · Keluar · Kembali
// X lives in Aksi because it is very rare in Malay and keeps every level at 6.
// Pure (no DOM): spellerStep(state, event, suggestions) → { state, action }.
// `suggestions` (words for the current prefix) come from the caller.
import { STRINGS } from './strings-ms.js';
import { rowSwitch } from './board-controller.js';

const T = STRINGS.speller;

export const LETTER_GROUPS = Object.freeze(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWYZ'].map((g) => [...g]));
export const SPELLER_COLUMNS = 3;

export function createSpellerState() {
  return { level: 'groups', group: 0, index: 0, text: '', spoken: false };
}

/** Letters typed for the word in progress ('' right after speaking or a space). */
export function currentPrefix(state) {
  if (state.spoken) return '';
  return state.text.split(' ').at(-1);
}

/** Tiles for the current level, in screen order. */
export function spellerTiles(state, suggestions = []) {
  if (state.level === 'suggest') {
    return [
      ...suggestions.map((w) => ({ label: w, word: w })),
      { label: T.actions, icon: '⚙️', actions: true },
      { label: T.back, icon: '↩️', back: true },
    ];
  }
  if (state.level === 'letters') {
    return [
      ...LETTER_GROUPS[state.group].map((ch) => ({ label: ch, letter: ch })),
      { label: T.back, icon: '↩️', back: true },
    ];
  }
  if (state.level === 'actions') {
    return [
      { label: T.speak, icon: '🔊', act: 'speak' },
      { label: T.space, icon: '␣', act: 'space' },
      { label: T.delete, icon: '⌫', act: 'delete' },
      { label: 'X', letter: 'X' },
      { label: T.exit, icon: '🏠', act: 'exit' },
      { label: T.back, icon: '↩️', back: true },
    ];
  }
  return [
    // Narrow no-break spaces: letters stay apart but the group never wraps.
    ...LETTER_GROUPS.map((g, i) => ({ label: g.join(' '), group: i })),
    suggestions.length
      ? { label: T.suggestions, icon: '💡', suggest: true }
      : { label: T.actions, icon: '⚙️', actions: true },
  ];
}

const toGroups = (state, changes = {}) => ({ ...state, level: 'groups', index: 0, ...changes });

/** Add a letter (or space). After a message was spoken, a new one starts. */
function type(state, ch) {
  const base = state.spoken ? '' : state.text;
  return toGroups(state, { text: base + ch, spoken: false });
}

/** Replace the word in progress with a chosen word, plus a space. */
function complete(state, word) {
  const prefix = currentPrefix(state);
  const base = state.spoken ? '' : state.text.slice(0, state.text.length - prefix.length);
  return toGroups(state, { text: `${base}${word} `, spoken: false });
}

/**
 * @param event 'LEFT'|'RIGHT'|'UP'|'DOWN'|'SELECT'|'BACK'
 * @param suggestions words for currentPrefix(state), most likely first
 * @returns {{ state, action: null | {type: 'speak', text} | {type: 'exit'} | {type: 'typed'} }}
 */
export function spellerStep(state, event, suggestions = []) {
  const tiles = spellerTiles(state, suggestions);
  const n = tiles.length;
  const move = (d) => ({ state: { ...state, index: (state.index + d + n) % n }, action: null });

  switch (event) {
    case 'LEFT': return move(-1);
    case 'RIGHT': return move(1);
    case 'UP': return { state: { ...state, index: rowSwitch(state.index, n, SPELLER_COLUMNS, -1) }, action: null };
    case 'DOWN': return { state: { ...state, index: rowSwitch(state.index, n, SPELLER_COLUMNS, 1) }, action: null };
    case 'BACK':
      return state.level === 'groups' ? { state, action: { type: 'exit' } } : { state: toGroups(state), action: null };
    case 'SELECT': {
      const tile = tiles[state.index];
      if (tile.group !== undefined) return { state: { ...state, level: 'letters', group: tile.group, index: 0 }, action: null };
      if (tile.actions) return { state: { ...state, level: 'actions', index: 0 }, action: null };
      if (tile.suggest) return { state: { ...state, level: 'suggest', index: 0 }, action: null };
      if (tile.word) return { state: complete(state, tile.word), action: { type: 'typed' } };
      if (tile.back) return { state: toGroups(state), action: null };
      if (tile.letter) return { state: type(state, tile.letter), action: { type: 'typed' } };
      if (tile.act === 'space') return { state: type(state, ' '), action: { type: 'typed' } };
      if (tile.act === 'delete') {
        const text = state.spoken ? '' : state.text.slice(0, -1);
        return { state: toGroups(state, { text, spoken: false }), action: { type: 'typed' } };
      }
      if (tile.act === 'speak') {
        const text = state.text.trim();
        // Lower case: some voices spell out ALL-CAPS words letter by letter.
        const action = text ? { type: 'speak', text: text.toLowerCase() } : null;
        return { state: toGroups(state, { spoken: Boolean(text) || state.spoken }), action };
      }
      if (tile.act === 'exit') return { state, action: { type: 'exit' } };
      return { state, action: null };
    }
    default:
      return { state, action: null };
  }
}
