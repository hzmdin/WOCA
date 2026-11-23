import { describe, it, expect } from 'vitest';
import { pageWindow, tilesOf, boardStep, createBoardState } from '../src/ui/board-controller.js';
import { tileSpeech } from '../src/ui/scan-audio.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { DEFAULT_SETTINGS } from '../src/storage/default-settings.js';
import { mergeSettings, pickEditable, validateSettings } from '../src/storage/settings-store.js';

const sizes = (n, size) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = pageWindow(i, n, size);
    if (!out.some((p) => p.start === w.start)) out.push(w);
  }
  return out.map((w) => w.end - w.start);
};

describe('pageWindow', () => {
  it('shows everything when it fits or when simple mode is off', () => {
    expect(pageWindow(2, 3, 3)).toEqual({ start: 0, end: 3, page: 0, pages: 1 });
    expect(pageWindow(5, 6, null)).toEqual({ start: 0, end: 6, page: 0, pages: 1 });
  });

  it('balances pages so none holds one lonely tile', () => {
    expect(sizes(6, 3)).toEqual([3, 3]);
    expect(sizes(5, 3)).toEqual([3, 2]);
    expect(sizes(4, 3)).toEqual([2, 2]);
    expect(sizes(7, 3)).toEqual([3, 2, 2]);
  });

  it('every tile is on exactly one page and the highlight is always on screen', () => {
    for (let n = 1; n <= 12; n++) {
      for (let i = 0; i < n; i++) {
        const w = pageWindow(i, n, 3);
        expect(i).toBeGreaterThanOrEqual(w.start);
        expect(i).toBeLessThan(w.end);
        expect(w.end - w.start).toBeLessThanOrEqual(3);
      }
    }
  });

  it('scanning past the end of a page flips to the next page, and wraps to the first', () => {
    const n = tilesOf(DEFAULT_BOARDS, 'home').length; // 6
    let s = createBoardState();
    const pages = [];
    for (let i = 0; i < n + 1; i++) {
      pages.push(pageWindow(s.index, n, 3).page);
      s = boardStep(s, 'RIGHT', DEFAULT_BOARDS, {}).state;
    }
    expect(pages).toEqual([0, 0, 0, 1, 1, 1, 0]);
  });
});

describe('audio scan wording', () => {
  it('reads a slash as "atau", not "garis miring"', () => {
    expect(tileSpeech({ label: 'Ya / Tidak' })).toBe('Ya atau Tidak');
    expect(tileSpeech({ label: 'Panas / Sejuk' })).toBe('Panas atau Sejuk');
    expect(tileSpeech({ label: 'Air' })).toBe('Air');
  });
});

describe('simple mode setting', () => {
  it('is off by default, valid, and saved as an editable setting', () => {
    expect(DEFAULT_SETTINGS.board.simpleMode).toBe(false);
    expect(DEFAULT_SETTINGS.board.simplePageSize).toBe(3);
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
    const stored = pickEditable({ ...DEFAULT_SETTINGS, board: { ...DEFAULT_SETTINGS.board, simpleMode: true } });
    expect(mergeSettings(stored).board.simpleMode).toBe(true);
  });
});
