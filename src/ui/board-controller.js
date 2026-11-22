// Board navigation: which board is shown, which tile is highlighted, and what
// a gesture event does. Pure (no DOM), so it is fully unit-tested.
//   LEFT / RIGHT  move the highlight (wraps around)
//   UP / DOWN     switch row, same column (only if those gestures are mapped;
//                 with at most 2 rows, one of them is enough)
//   SELECT        open the tile: go to a board, go back, or speak
//   BACK          go to the previous board
//   HOME          go to Home (used after a phrase is spoken)
// On a Yes/No board (mode 'yesno'), LEFT/RIGHT answer immediately and
// SELECT/BACK go back; the user stays on the board between answers.
//
// opts (all functions): { yesSide: 'left' | 'right' } from settings.board
import { STRINGS } from './strings-ms.js';
import { HOME_BOARD } from '../storage/default-boards.js';

const BACK_TILE = Object.freeze({ label: STRINGS.board.back, icon: '↩️', back: true });

const findBoard = (boards, id) => boards.find((b) => b.id === id);

export const isYesNo = (boards, boardId) => findBoard(boards, boardId)?.mode === 'yesno';

/**
 * Tiles to show for a board, in screen order. Normal boards get "Kembali"
 * (except Home). Yes/No boards are [left half, right half].
 */
export function tilesOf(boards, boardId, { yesSide = 'left' } = {}) {
  const board = findBoard(boards, boardId);
  if (!board) return [];
  if (board.mode === 'yesno') {
    const [yes, no] = board.tiles;
    return yesSide === 'right' ? [no, yes] : [yes, no];
  }
  return boardId === HOME_BOARD ? board.tiles : [...board.tiles, BACK_TILE];
}

/**
 * Index of the tile in the next row up (dir -1) or down (+1), same column,
 * wrapping around. On a short last row it lands on the last tile.
 * e.g. 5 tiles in 3 columns: 0↔3, 1↔4, 2↔4.
 */
export function rowSwitch(index, n, cols, dir) {
  const rows = Math.ceil(n / cols);
  if (rows <= 1) return index;
  const row = (Math.floor(index / cols) + dir + rows) % rows;
  return Math.min(row * cols + (index % cols), n - 1);
}

/** Columns for n big tiles: 1–3 in one row, 4 as 2×2, 5–6 as 3×2. */
export function gridColumns(n) {
  if (n <= 3) return Math.max(1, n);
  if (n === 4) return 2;
  return 3;
}

/** Problems with board data (empty list = OK). Used for defaults and edited boards. */
export function validateBoards(boards, { maxTiles }) {
  const errors = [];
  const ids = new Set(boards.map((b) => b.id));
  if (!ids.has(HOME_BOARD)) errors.push(`missing "${HOME_BOARD}" board`);
  for (const b of boards) {
    const shown = tilesOf(boards, b.id).length;
    if (!b.tiles?.length) errors.push(`${b.id}: no tiles`);
    if (b.mode === 'yesno' && (b.tiles?.length !== 2 || b.tiles.some((t) => !t.say))) {
      errors.push(`${b.id}: yes/no board needs exactly 2 tiles that "say"`);
    }
    if (shown > maxTiles) errors.push(`${b.id}: ${shown} tiles shown, max ${maxTiles}`);
    for (const t of b.tiles ?? []) {
      if (!t.label) errors.push(`${b.id}: tile without label`);
      if (!t.say && !t.goto && !t.alert && !t.speller) errors.push(`${b.id}/${t.label}: needs "say", "goto", "alert" or "speller"`);
      if (t.goto && !ids.has(t.goto)) errors.push(`${b.id}/${t.label}: goto unknown board "${t.goto}"`);
    }
  }
  return errors;
}

export function createBoardState(boardId = HOME_BOARD) {
  return { boardId, index: 0, history: [] };
}

const goTo = (state, boardId) => ({ boardId, index: 0, history: [...state.history, state.boardId] });
const goBack = (state) =>
  state.history.length
    ? { boardId: state.history.at(-1), index: 0, history: state.history.slice(0, -1) }
    : { ...state, boardId: HOME_BOARD, index: 0 };

const speakAction =(tile, extra = {}) => ({ type: 'speak', text: tile.say, audio: tile.audio, label: tile.label, ...extra });

/** Yes/No board: a turn answers (highlighting that half), SELECT/BACK leave. */
function yesNoStep(state, event, tiles) {
  switch (event) {
    case 'LEFT':
    case 'RIGHT': {
      const index = event === 'LEFT' ? 0 : 1;
      // stay: keep the user on this board for the next question (no auto-Home).
      // answered: only now highlight a half (nothing is "chosen" on arrival).
      return { state: { ...state, index, answered: true }, action: speakAction(tiles[index], { stay: true }) };
    }
    case 'SELECT':
    case 'BACK':
      return { state: goBack(state), action: { type: 'navigate' } };
    case 'HOME':
      return { state: createBoardState(), action: { type: 'navigate' } };
    default:
      return { state, action: null };
  }
}

/**
 * @param event 'LEFT'|'RIGHT'|'UP'|'DOWN'|'SELECT'|'BACK'|'HOME'
 * @returns {{ state, action: null | {type: 'navigate'} | {type: 'alert'} | {type: 'speller'} | {type: 'speak', text, audio, label, stay?} }}
 */
export function boardStep(state, event, boards, opts = {}) {
  const tiles = tilesOf(boards, state.boardId, opts);
  const n = tiles.length;
  if (!n) return { state: createBoardState(), action: { type: 'navigate' } };
  if (isYesNo(boards, state.boardId)) return yesNoStep(state, event, tiles);
  const cols = gridColumns(n);
  const move = (delta) => ({ state: { ...state, index: (state.index + delta + n) % n }, action: null });

  switch (event) {
    case 'LEFT': return move(-1);
    case 'RIGHT': return move(1);
    case 'UP': return { state: { ...state, index: rowSwitch(state.index, n, cols, -1) }, action: null };
    case 'DOWN': return { state: { ...state, index: rowSwitch(state.index, n, cols, 1) }, action: null };
    case 'BACK': return { state: goBack(state), action: { type: 'navigate' } };
    case 'HOME': return { state: createBoardState(), action: { type: 'navigate' } };
    case 'SELECT': {
      const tile = tiles[state.index];
      if (tile.alert) return { state, action: { type: 'alert' } };
      if (tile.speller) return { state, action: { type: 'speller' } };
      if (tile.back) return { state: goBack(state), action: { type: 'navigate' } };
      if (tile.goto) return { state: goTo(state, tile.goto), action: { type: 'navigate' } };
      return { state, action: speakAction(tile) };
    }
    default:
      return { state, action: null };
  }
}
