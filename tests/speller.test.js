import { describe, it, expect } from 'vitest';
import { createSpellerState, spellerStep, spellerTiles, currentPrefix, LETTER_GROUPS } from '../src/ui/speller-controller.js';

/** Apply events; return final state and actions. */
function run(events, state = createSpellerState()) {
  const actions = [];
  for (const ev of events) {
    const out = spellerStep(state, ev);
    state = out.state;
    if (out.action) actions.push(out.action);
  }
  return { state, actions };
}

/** Events that type one letter from the groups level using only RIGHT + SELECT. */
function letterEvents(ch) {
  if (ch === 'X') return [...Array(5).fill('RIGHT'), 'SELECT', 'RIGHT', 'RIGHT', 'RIGHT', 'SELECT'];
  const g = LETTER_GROUPS.findIndex((grp) => grp.includes(ch));
  const i = LETTER_GROUPS[g].indexOf(ch);
  return [...Array(g).fill('RIGHT'), 'SELECT', ...Array(i).fill('RIGHT'), 'SELECT'];
}
const ACTIONS = [...Array(5).fill('RIGHT'), 'SELECT']; // Aksi is the 6th group tile
const SPEAK = [...ACTIONS, 'SELECT']; // Sebut is the 1st action
const SPACE = [...ACTIONS, 'RIGHT', 'SELECT'];
const DELETE = [...ACTIONS, 'RIGHT', 'RIGHT', 'SELECT'];
const EXIT = [...ACTIONS, 'LEFT', 'LEFT', 'SELECT']; // Keluar is 5th of 6
const type = (word) => [...word].flatMap((ch) => (ch === ' ' ? SPACE : letterEvents(ch)));

describe('layout', () => {
  it('has all 26 letters', () => {
    const all = [...LETTER_GROUPS.flat(), 'X'].sort().join('');
    expect(all).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('every level has at most 6 tiles (1/6 of the screen each)', () => {
    let s = createSpellerState();
    expect(spellerTiles(s)).toHaveLength(6);
    for (let g = 0; g < LETTER_GROUPS.length; g++) {
      expect(spellerTiles({ ...s, level: 'letters', group: g })).toHaveLength(6);
    }
    expect(spellerTiles({ ...s, level: 'actions' })).toHaveLength(6);
  });

  it('"Aksi" is the last group tile: one LEFT from the start', () => {
    expect(run(['LEFT']).state.index).toBe(5);
    expect(spellerTiles(createSpellerState())[5].actions).toBe(true);
  });
});

describe('typing', () => {
  it('group then letter types it and returns to the groups', () => {
    const { state, actions } = run(letterEvents('K'));
    expect(state).toMatchObject({ text: 'K', level: 'groups', index: 0 });
    expect(actions).toEqual([{ type: 'typed' }]);
  });

  it('types a whole word, spaces included', () => {
    expect(run(type('SAYA SAKIT')).state.text).toBe('SAYA SAKIT');
  });

  it('X is in Aksi', () => {
    expect(run(letterEvents('X')).state.text).toBe('X');
  });

  it('Kembali on a letter level goes back to the groups without typing', () => {
    const r = run(['SELECT', 'LEFT', 'SELECT']); // group ABCDE, Kembali (last)
    expect(r.state).toMatchObject({ level: 'groups', text: '' });
  });

  it('Padam deletes the last letter', () => {
    expect(run([...type('AIR'), ...DELETE]).state.text).toBe('AI');
  });

  it('Padam on empty text does nothing harmful', () => {
    expect(run(DELETE).state.text).toBe('');
  });
});

describe('speaking and exiting', () => {
  it('Sebut speaks the text in lower case (some voices spell ALL CAPS)', () => {
    const { actions } = run([...type('SAKIT'), ...SPEAK]);
    expect(actions.at(-1)).toEqual({ type: 'speak', text: 'sakit' });
  });

  it('the text stays visible after speaking; the next letter starts a new message', () => {
    const spoken = run([...type('YA'), ...SPEAK]).state;
    expect(spoken.text).toBe('YA');
    expect(run(letterEvents('T'), spoken).state.text).toBe('T');
  });

  it('Sebut with no text says nothing', () => {
    expect(run(SPEAK).actions).toEqual([]);
  });

  it('Keluar exits; BACK on the groups level exits too; BACK on a sub-level goes up', () => {
    expect(run(EXIT).actions.at(-1)).toEqual({ type: 'exit' });
    expect(run(['BACK']).actions).toEqual([{ type: 'exit' }]);
    expect(run(['SELECT', 'BACK']).state.level).toBe('groups');
  });

  it('UP/DOWN move by a row (3 columns)', () => {
    expect(run(['DOWN']).state.index).toBe(3);
    expect(run(['UP']).state.index).toBe(3);
  });
});

describe('word suggestions', () => {
  const SUG = ['SAYA', 'SAKIT', 'SAYANG'];
  /** Like run(), but passes suggestions to every step. */
  function runWith(events, suggestions, state = createSpellerState()) {
    const actions = [];
    for (const ev of events) {
      const out = spellerStep(state, ev, suggestions);
      state = out.state;
      if (out.action) actions.push(out.action);
    }
    return { state, actions };
  }
  const typed = (text, extra = {}) => ({ ...createSpellerState(), text, ...extra });

  it('currentPrefix is the word in progress', () => {
    expect(currentPrefix(typed('SAYA SA'))).toBe('SA');
    expect(currentPrefix(typed('SAYA '))).toBe('');
    expect(currentPrefix(typed('SAKIT', { spoken: true }))).toBe('');
  });

  it('with suggestions, the last group tile becomes "Cadangan" (still 6 tiles)', () => {
    const tiles = spellerTiles(typed('SA'), SUG);
    expect(tiles).toHaveLength(6);
    expect(tiles[5]).toMatchObject({ label: 'Cadangan', suggest: true });
    expect(spellerTiles(typed(''), [])[5].actions).toBe(true); // no suggestions → Aksi
  });

  it('Cadangan level: the words, then Aksi and Kembali (max 5 tiles)', () => {
    const tiles = spellerTiles({ ...typed('SA'), level: 'suggest' }, SUG);
    expect(tiles.map((t) => t.label)).toEqual(['SAYA', 'SAKIT', 'SAYANG', 'Aksi', 'Kembali']);
  });

  it('choosing a word completes it and adds a space', () => {
    // LEFT → Cadangan, SELECT, RIGHT → SAKIT, SELECT
    const { state, actions } = runWith(['LEFT', 'SELECT', 'RIGHT', 'SELECT'], SUG, typed('SAYA SA'));
    expect(state.text).toBe('SAYA SAKIT ');
    expect(state.level).toBe('groups');
    expect(actions).toEqual([{ type: 'typed' }]);
  });

  it('after speaking, a chosen word starts a new message', () => {
    const { state } = runWith(['LEFT', 'SELECT', 'SELECT'], SUG, typed('SA', { spoken: true }));
    expect(state.text).toBe('SAYA ');
  });

  it('Aksi is still reachable from Cadangan', () => {
    const { state } = runWith(['LEFT', 'SELECT', 'RIGHT', 'RIGHT', 'RIGHT', 'SELECT'], SUG, typed('SA'));
    expect(state.level).toBe('actions');
  });

  it('one letter + Cadangan types a whole word', () => {
    // From empty: S (PQRST group, 4th letter) → Cadangan → first word.
    const afterS = runWith(['RIGHT', 'RIGHT', 'RIGHT', 'SELECT', 'RIGHT', 'RIGHT', 'RIGHT', 'SELECT'], []).state;
    expect(afterS.text).toBe('S');
    const { state } = runWith(['LEFT', 'SELECT', 'SELECT'], SUG, afterS);
    expect(state.text).toBe('SAYA ');
  });
});
