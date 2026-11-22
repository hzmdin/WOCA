import { describe, it, expect } from 'vitest';
import {
  tilesOf,
  gridColumns,
  validateBoards,
  createBoardState,
  boardStep,
  rowSwitch,
} from '../src/ui/board-controller.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { DEFAULT_SETTINGS } from '../src/storage/default-settings.js';

const boards = DEFAULT_BOARDS;

/** Apply a list of events, return final state and all actions. */
function run(events, state = createBoardState()) {
  const actions = [];
  for (const ev of events) {
    const out = boardStep(state, ev, boards);
    state = out.state;
    if (out.action) actions.push(out.action);
  }
  return { state, actions };
}

describe('default boards', () => {
  it('are valid (every goto exists, every tile says or goes somewhere, max 6 tiles)', () => {
    expect(validateBoards(boards, DEFAULT_SETTINGS.board)).toEqual([]);
  });

  it('are all in Malay with full spoken sentences', () => {
    for (const b of boards) for (const t of b.tiles) if (t.say) expect(t.say).toMatch(/[.!?]$/);
  });
});

describe('validateBoards', () => {
  it('reports broken data', () => {
    const bad = [
      { id: 'home', tiles: [{ label: 'X', goto: 'nowhere' }, { label: 'Y' }] },
      { id: 'big', tiles: Array.from({ length: 6 }, (_, i) => ({ label: `t${i}`, say: 'Ya.' })) },
    ];
    const errors = validateBoards(bad, { maxTiles: 6 });
    expect(errors).toContain('home/X: goto unknown board "nowhere"');
    expect(errors).toContain('home/Y: needs "say", "goto", "alert" or "speller"');
    expect(errors).toContain('big: 7 tiles shown, max 6'); // 6 + automatic back tile
  });

  it('a yes/no board needs exactly two speaking tiles', () => {
    const bad = [
      { id: 'home', tiles: [{ label: 'YN', goto: 'yn' }] },
      { id: 'yn', mode: 'yesno', tiles: [{ label: 'Ya', say: 'Ya.' }] },
    ];
    expect(validateBoards(bad, { maxTiles: 6 })).toContain('yn: yes/no board needs exactly 2 tiles that "say"');
  });

  it('requires a home board', () => {
    expect(validateBoards([{ id: 'x', tiles: [{ label: 'a', say: 'a.' }] }], { maxTiles: 6 })).toContain(
      'missing "home" board'
    );
  });
});

describe('tilesOf / gridColumns', () => {
  it('adds "Kembali" to non-home boards only', () => {
    expect(tilesOf(boards, 'home').some((t) => t.back)).toBe(false);
    expect(tilesOf(boards, 'needs').at(-1)).toMatchObject({ label: 'Kembali', back: true });
  });

  it('yes/no board has no back tile; yes is on the configured side', () => {
    expect(tilesOf(boards, 'yesno').map((t) => t.label)).toEqual(['Ya', 'Tidak']);
    expect(tilesOf(boards, 'yesno', { yesSide: 'right' }).map((t) => t.label)).toEqual(['Tidak', 'Ya']);
  });

  it('lays out big tiles', () => {
    expect([1, 2, 3, 4, 5, 6].map(gridColumns)).toEqual([1, 2, 3, 2, 3, 3]);
  });
});

describe('boardStep', () => {
  // Home tiles: [Ya / Tidak, Keperluan, Sayang, Terima kasih, Eja, Tolong!] (3×2)
  const TO_NEEDS = ['RIGHT', 'SELECT'];

  it('RIGHT/LEFT move the highlight and wrap around', () => {
    expect(run(['RIGHT']).state.index).toBe(1);
    expect(run(['LEFT']).state.index).toBe(tilesOf(boards, 'home').length - 1);
    expect(run(Array(6).fill('RIGHT')).state.index).toBe(0); // home has 6 tiles
  });

  it('flow B from the spec: Home → Keperluan → Air speaks the full sentence', () => {
    const { state, actions } = run([...TO_NEEDS, 'SELECT']); // Air is the first tile
    expect(state.boardId).toBe('needs');
    expect(actions.at(-1)).toEqual({ type: 'speak', text: 'Saya nak minum air.', audio: undefined, label: 'Air' });
  });

  it('speaking does not change the board', () => {
    const before = run(TO_NEEDS).state;
    const after = boardStep(before, 'SELECT', boards).state;
    expect(after).toEqual(before);
  });

  it('nested boards and the back tile', () => {
    // Home → Keperluan → Panas/Sejuk (5th tile) → Sejuk
    const deep = run([...TO_NEEDS, 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'SELECT', 'RIGHT', 'SELECT']);
    expect(deep.state.boardId).toBe('temperature');
    expect(deep.actions.at(-1).text).toBe('Saya rasa sejuk.');
    // Kembali (3rd tile on temperature) → back to needs, then Kembali → home
    const back = run(['RIGHT', 'SELECT'], deep.state);
    expect(back.state.boardId).toBe('needs');
    const home = run(['LEFT', 'SELECT'], back.state); // Kembali is the last tile
    expect(home.state.boardId).toBe('home');
  });

  it('BACK event goes to the previous board; on Home it stays on Home', () => {
    expect(run([...TO_NEEDS, 'BACK']).state.boardId).toBe('home');
    expect(run(['BACK']).state).toMatchObject({ boardId: 'home', index: 0 });
  });

  it('HOME resets to Home from anywhere', () => {
    expect(run([...TO_NEEDS, 'RIGHT', 'HOME']).state).toEqual(createBoardState());
  });

  it('a new board starts with the first tile highlighted', () => {
    expect(run(TO_NEEDS).state.index).toBe(0);
  });

  it('UP/DOWN move by a row on two-row boards, and do nothing on one-row boards', () => {
    const needs = run(TO_NEEDS).state; // 6 tiles → 3 columns × 2 rows
    expect(boardStep(needs, 'DOWN', boards).state.index).toBe(3);
    expect(boardStep(needs, 'UP', boards).state.index).toBe(3); // wraps
    expect(run(['DOWN']).state.index).toBe(3); // home: 3 columns
    const temperature = run([...TO_NEEDS, 'LEFT', 'LEFT', 'SELECT']).state; // 3 tiles, one row
    expect(temperature.boardId).toBe('temperature');
    expect(boardStep(temperature, 'DOWN', boards).state.index).toBe(0);
  });

  it('the "Eja" tile opens the speller', () => {
    expect(boardStep({ ...createBoardState(), index: 4 }, 'SELECT', boards).action).toEqual({ type: 'speller' });
  });

  it('ignores unknown events', () => {
    expect(boardStep(createBoardState(), 'PAUSE', boards)).toEqual({ state: createBoardState(), action: null });
  });

  it('recovers if the current board no longer exists (e.g. edited away)', () => {
    const out = boardStep({ boardId: 'gone', index: 2, history: [] }, 'RIGHT', boards);
    expect(out.state).toEqual(createBoardState());
  });
});

describe('Yes/No board', () => {
  const open = run(['SELECT']).state; // Ya / Tidak is the first Home tile

  it('opens from Home', () => {
    expect(open.boardId).toBe('yesno');
  });

  it('a head turn answers straight away: left = Ya, right = Tidak', () => {
    expect(boardStep(open, 'LEFT', boards).action).toMatchObject({ type: 'speak', text: 'Ya.', stay: true });
    expect(boardStep(open, 'RIGHT', boards).action).toMatchObject({ type: 'speak', text: 'Tidak.', stay: true });
  });

  it('highlights the half that was answered, and stays on the board', () => {
    const out = boardStep(open, 'RIGHT', boards);
    expect(out.state).toMatchObject({ boardId: 'yesno', index: 1 });
  });

  it('yesSide "right" swaps the answers', () => {
    const opts = { yesSide: 'right' };
    expect(boardStep(open, 'LEFT', boards, opts).action.text).toBe('Tidak.');
    expect(boardStep(open, 'RIGHT', boards, opts).action.text).toBe('Ya.');
  });

  it('SELECT (long blink) or BACK goes back to Home', () => {
    expect(boardStep(open, 'SELECT', boards).state.boardId).toBe('home');
    expect(boardStep(open, 'BACK', boards).state.boardId).toBe('home');
  });

  it('UP/DOWN do nothing', () => {
    expect(boardStep(open, 'UP', boards)).toEqual({ state: open, action: null });
  });

  it('task 3.3 check: 10 answers in a row are all correct', () => {
    const answers = ['LEFT', 'RIGHT', 'RIGHT', 'LEFT', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'LEFT', 'LEFT'];
    let state = open;
    const said = answers.map((ev) => {
      const out = boardStep(state, ev, boards);
      state = out.state;
      return out.action.text;
    });
    expect(said).toEqual(answers.map((ev) => (ev === 'LEFT' ? 'Ya.' : 'Tidak.')));
    expect(state.boardId).toBe('yesno');
  });
});

describe('rowSwitch (UP/DOWN = switch row, same column)', () => {
  it('6 tiles in 3 columns: straight up/down, wrapping', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => rowSwitch(i, 6, 3, 1))).toEqual([3, 4, 5, 0, 1, 2]);
    expect([0, 1, 2, 3, 4, 5].map((i) => rowSwitch(i, 6, 3, -1))).toEqual([3, 4, 5, 0, 1, 2]);
  });

  it('5 tiles (short second row): lands on the tile below, or the last one', () => {
    expect([0, 1, 2, 3, 4].map((i) => rowSwitch(i, 5, 3, 1))).toEqual([3, 4, 4, 0, 1]);
  });

  it('2×2 and single rows', () => {
    expect([0, 1, 2, 3].map((i) => rowSwitch(i, 4, 2, 1))).toEqual([2, 3, 0, 1]);
    expect(rowSwitch(1, 3, 3, 1)).toBe(1);
  });

  it('with ≤2 rows, UP and DOWN do the same thing (so one gesture is enough)', () => {
    for (const [n, cols] of [[6, 3], [5, 3], [4, 2]]) {
      for (let i = 0; i < n; i++) expect(rowSwitch(i, n, cols, -1)).toBe(rowSwitch(i, n, cols, 1));
    }
  });
});
