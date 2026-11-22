import { describe, it, expect } from 'vitest';
import { loadBoards, saveBoards, updateTile, addTile, removeTile, withSpellerTile, BOARDS_KEY } from '../src/storage/boards-store.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}
const tile = (boards, id, i) => boards.find((b) => b.id === id).tiles[i];

describe('boards store', () => {
  it('defaults when nothing is saved, or when saved data is broken', () => {
    expect(loadBoards(memoryStorage())).toBe(DEFAULT_BOARDS);
    expect(loadBoards(memoryStorage({ [BOARDS_KEY]: '{oops' }))).toBe(DEFAULT_BOARDS);
    expect(loadBoards(memoryStorage({ [BOARDS_KEY]: '[{"id":"x","tiles":[]}]' }))).toBe(DEFAULT_BOARDS);
  });

  it('saves and loads edited boards', () => {
    const storage = memoryStorage();
    const edited = updateTile(DEFAULT_BOARDS, 'needs', 0, { say: 'Saya haus.' });
    expect(saveBoards(edited, storage)).toBe(true);
    expect(tile(loadBoards(storage), 'needs', 0).say).toBe('Saya haus.');
  });

  it('refuses to save boards that break the rules (e.g. too many tiles)', () => {
    let b = DEFAULT_BOARDS;
    b = addTile(b, 'needs'); // needs: 5 + new + Kembali = 7 > 6
    expect(saveBoards(b, memoryStorage())).toBe(false);
  });
});

describe('editing helpers', () => {
  it('updateTile changes label, icon and phrase without touching the original', () => {
    const b = updateTile(DEFAULT_BOARDS, 'needs', 0, { label: 'Minum', icon: '🥤', say: 'Saya haus.' });
    expect(tile(b, 'needs', 0)).toEqual({ label: 'Minum', icon: '🥤', say: 'Saya haus.' });
    expect(tile(DEFAULT_BOARDS, 'needs', 0).label).toBe('Air');
  });

  it('updateTile keeps navigation/help behaviour (no phrase added to them)', () => {
    const b = updateTile(DEFAULT_BOARDS, 'home', 1, { label: 'Perlu', say: 'x' });
    expect(tile(b, 'home', 1)).toMatchObject({ label: 'Perlu', goto: 'needs' });
    expect(tile(b, 'home', 1).say).toBeUndefined();
  });

  it('addTile adds a speaking tile; not on the Yes/No board', () => {
    expect(addTile(DEFAULT_BOARDS, 'temperature').find((x) => x.id === 'temperature').tiles).toHaveLength(3);
    expect(addTile(DEFAULT_BOARDS, 'yesno').find((x) => x.id === 'yesno').tiles).toHaveLength(2);
  });

  it('removeTile removes phrases only (never navigation, help or Yes/No tiles)', () => {
    expect(removeTile(DEFAULT_BOARDS, 'needs', 0).find((x) => x.id === 'needs').tiles).toHaveLength(4);
    expect(removeTile(DEFAULT_BOARDS, 'home', 1)).toEqual(DEFAULT_BOARDS); // Keperluan (goto)
    expect(removeTile(DEFAULT_BOARDS, 'home', 4)).toEqual(DEFAULT_BOARDS); // Eja (speller)
    expect(removeTile(DEFAULT_BOARDS, 'home', 5)).toEqual(DEFAULT_BOARDS); // Tolong! (alert)
    expect(removeTile(DEFAULT_BOARDS, 'yesno', 0)).toEqual(DEFAULT_BOARDS);
  });
});

describe('upgrading boards saved before the speller existed', () => {
  const oldHome = DEFAULT_BOARDS.map((b) => (b.id === 'home' ? { ...b, tiles: b.tiles.filter((t) => !t.speller) } : b));

  it('adds "Eja" before "Tolong!" when loading', () => {
    const storage = memoryStorage({ [BOARDS_KEY]: JSON.stringify(oldHome) });
    const labels = loadBoards(storage).find((b) => b.id === 'home').tiles.map((t) => t.label);
    expect(labels.slice(-2)).toEqual(['Eja', 'Tolong!']);
  });

  it('leaves boards alone that already have it, or have no room', () => {
    expect(withSpellerTile(DEFAULT_BOARDS)).toBe(DEFAULT_BOARDS);
    const full = addTile(oldHome, 'home'); // 6 tiles, no Eja
    expect(withSpellerTile(full)).toBe(full);
  });
});
