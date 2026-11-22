// The caregiver's edited boards (phrases), saved in localStorage, plus small
// pure helpers the phrase editor uses. Invalid data falls back to defaults.
import { DEFAULT_BOARDS } from './default-boards.js';
import { validateBoards } from '../ui/board-controller.js';
import { DEFAULT_SETTINGS } from './default-settings.js';

export const BOARDS_KEY = 'woca.boards';

const limits = () => DEFAULT_SETTINGS.board;
const clone = (boards) => JSON.parse(JSON.stringify(boards));

export function loadBoards(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(BOARDS_KEY) ?? 'null');
    if (Array.isArray(stored) && validateBoards(stored, limits()).length === 0) return withSpellerTile(stored);
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_BOARDS;
}

/** @returns true if saved (refuses boards that fail validation) */
export function saveBoards(boards, storage = globalThis.localStorage) {
  if (validateBoards(boards, limits()).length) return false;
  try {
    storage.setItem(BOARDS_KEY, JSON.stringify(boards));
    return true;
  } catch {
    return false;
  }
}

export function clearBoards(storage = globalThis.localStorage) {
  try {
    storage.removeItem(BOARDS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Boards saved before the speller existed have no "Eja" tile. Add it to Home
 * (before the help tile) if there is room, so an upgrade doesn't hide it.
 */
export function withSpellerTile(boards) {
  if (boards.some((b) => b.tiles.some((t) => t.speller))) return boards;
  const out = clone(boards);
  const home = out.find((b) => b.id === 'home');
  if (!home || home.tiles.length >= limits().maxTiles) return boards;
  const helpIndex = home.tiles.findIndex((t) => t.alert);
  const tile = DEFAULT_BOARDS[0].tiles.find((t) => t.speller);
  home.tiles.splice(helpIndex === -1 ? home.tiles.length : helpIndex, 0, { ...tile });
  return out;
}

// ---- Pure editing helpers (each returns a NEW boards array) ----

/** Change label / icon / say of one tile. Other fields (goto, alert) are kept. */
export function updateTile(boards, boardId, index, changes) {
  const out = clone(boards);
  const tile = out.find((b) => b.id === boardId)?.tiles[index];
  if (!tile) return out;
  for (const key of ['label', 'icon', 'say']) {
    if (changes[key] === undefined) continue;
    if (key === 'say' && !tile.say) continue; // only speaking tiles have a phrase
    tile[key] = changes[key];
  }
  return out;
}

/** Add a new speaking tile at the end of a normal board. */
export function addTile(boards, boardId, tile = { label: 'Baru', icon: '💬', say: 'Frasa baru.' }) {
  const out = clone(boards);
  const board = out.find((b) => b.id === boardId);
  if (board && board.mode !== 'yesno') board.tiles.push({ ...tile });
  return out;
}

/** Remove a speaking tile. Navigation, help and Yes/No tiles cannot be removed. */
export function removeTile(boards, boardId, index) {
  const out = clone(boards);
  const board = out.find((b) => b.id === boardId);
  const tile = board?.tiles[index];
  if (!tile || board.mode === 'yesno' || !tile.say || board.tiles.length <= 1) return out;
  board.tiles.splice(index, 1);
  return out;
}
