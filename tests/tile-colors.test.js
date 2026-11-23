import { describe, it, expect } from 'vitest';
import { tileColor, yesNoColor, GROUP_COLORS } from '../src/ui/tile-colors.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { spellerTiles, createSpellerState } from '../src/ui/speller-controller.js';
import { tilesOf } from '../src/ui/board-controller.js';

const KNOWN = new Set(['sky', 'blue', 'orange', 'green', 'purple', 'red', 'grey']);

describe('tileColor', () => {
  it('the help tile is the only red tile on any board', () => {
    const reds = [];
    for (const b of DEFAULT_BOARDS) {
      for (const t of tilesOf(DEFAULT_BOARDS, b.id)) if (tileColor(t, b.id) === 'red') reds.push(t.label);
    }
    expect(reds).toEqual(['Tolong!']);
  });

  it('every default tile gets a known colour', () => {
    for (const b of DEFAULT_BOARDS) {
      if (b.mode === 'yesno') continue;
      for (const t of tilesOf(DEFAULT_BOARDS, b.id)) expect(KNOWN.has(tileColor(t, b.id)), `${b.id}/${t.label}`).toBe(true);
    }
  });

  it('same kind, same colour: menus sky, speller blue, feelings purple, needs green, back grey', () => {
    expect(tileColor({ goto: 'needs' }, 'home')).toBe('sky');
    expect(tileColor({ say: 'x.' }, 'home')).toBe('purple');
    expect(tileColor({ say: 'x.' }, 'needs')).toBe('green');
    expect(tileColor({ back: true }, 'needs')).toBe('grey');
    expect(tileColor({ speller: true }, 'home')).toBe('blue');
  });

  it('a colour set on the tile wins', () => {
    expect(tileColor({ say: 'x.', color: 'blue' }, 'needs')).toBe('blue');
  });

  it('speller groups have distinct colours and their letters share the open group colour', () => {
    expect(new Set(GROUP_COLORS).size).toBe(GROUP_COLORS.length);
    const groups = spellerTiles(createSpellerState()).filter((t) => t.group !== undefined);
    expect(groups.map((t) => tileColor(t))).toEqual(GROUP_COLORS);
    const letters = spellerTiles({ ...createSpellerState(), level: 'letters', group: 2 }).filter((t) => t.letter);
    for (const t of letters) expect(tileColor(t, null, 2)).toBe(GROUP_COLORS[2]);
  });

  it('Yes/No uses blue and orange (never red/green) and follows the yes side', () => {
    expect([yesNoColor(0, 'left'), yesNoColor(1, 'left')]).toEqual(['blue', 'orange']);
    expect([yesNoColor(0, 'right'), yesNoColor(1, 'right')]).toEqual(['orange', 'blue']);
  });
});
