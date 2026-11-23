import { describe, it, expect } from 'vitest';
import { createScanState, scanStep } from '../src/ui/scan-timer.js';
import { createBoardState, boardStep, tilesOf } from '../src/ui/board-controller.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';
import { DEFAULT_SETTINGS } from '../src/storage/default-settings.js';
import { validateSettings, mergeSettings, pickEditable } from '../src/storage/settings-store.js';

const OPTS = { stepMs: 2500, startExtraMs: 1500 };
const base = { live: true, holding: false, screen: 'board:home', index: 0 };

/** Run the timer every 100 ms for `ms`, return when each advance happened. */
function run(ms, input = {}, startState = createScanState(), startAt = 0) {
  let state = startState;
  let index = input.index ?? 0;
  const advances = [];
  for (let now = startAt; now <= startAt + ms; now += 100) {
    const out = scanStep(state, { ...base, ...input, index, now }, OPTS);
    state = out.state;
    if (out.advance) {
      advances.push(now);
      index += 1; // the screen would move the highlight
    }
  }
  return { advances, state, index };
}

describe('scanStep', () => {
  it('the first move waits stepMs + startExtraMs, later moves every stepMs', () => {
    const { advances } = run(10000);
    // each step is stepMs plus one 100 ms check: the highlight moves a tick after the timer fires
    expect(advances).toEqual([4000, 6600, 9200]);
  });

  it('never moves while input is not live (paused, face lost, blocked)', () => {
    expect(run(20000, { live: false }).advances).toEqual([]);
  });

  it('never moves while SELECT is held, and restarts the dwell time after release', () => {
    const held = run(6000, { holding: true });
    expect(held.advances).toEqual([]);
    // released at t=6000: the tile gets a full stepMs before the next move
    const after = run(3000, {}, held.state, 6100);
    expect(after.advances[0]).toBeGreaterThanOrEqual(6000 + 2500); // counted from the last held tick
  });

  it('a new screen restarts with the extra time', () => {
    const first = run(5000);
    const next = run(5000, { screen: 'board:needs', index: 0 }, first.state, 5100);
    expect(next.advances[0]).toBeGreaterThanOrEqual(5100 + 4000);
  });

  it('becoming live again gives a fresh, longer first step', () => {
    const away = run(3000, { live: false });
    const back = run(5000, {}, away.state, 3100);
    expect(back.advances[0]).toBeGreaterThanOrEqual(3100 + 4000);
  });

  it('a highlight moved by the caregiver gets its full time', () => {
    const t0 = run(3000);
    const moved = scanStep(t0.state, { ...base, index: 3, now: 3100 }, OPTS);
    expect(moved.advance).toBe(false);
    expect(moved.state.dueAt).toBe(3100 + 2500);
  });
});

describe('boards while scanning', () => {
  const scan = { scan: true };

  it('Yes/No becomes Ya, Tidak, Kembali, highlighted and chosen with SELECT, staying on the board', () => {
    expect(tilesOf(DEFAULT_BOARDS, 'yesno', scan).map((t) => t.label)).toEqual(['Ya', 'Tidak', 'Kembali']);
    let s = { ...createBoardState('yesno'), history: ['home'] };
    s = boardStep(s, 'RIGHT', DEFAULT_BOARDS, scan).state;
    const out = boardStep(s, 'SELECT', DEFAULT_BOARDS, scan);
    expect(out.action).toMatchObject({ type: 'speak', text: 'Tidak.', stay: true });
    // the back tile leaves
    const back = boardStep({ ...out.state, index: 2 }, 'SELECT', DEFAULT_BOARDS, scan);
    expect(back.state.boardId).toBe('home');
  });

  it('without scan, Yes/No still answers on a turn (unchanged)', () => {
    const out = boardStep(createBoardState('yesno'), 'LEFT', DEFAULT_BOARDS, {});
    expect(out.action).toMatchObject({ type: 'speak', text: 'Ya.', stay: true });
  });
});

describe('scan settings', () => {
  it('is off by default, valid, and saved/restored as editable fields', () => {
    expect(DEFAULT_SETTINGS.scan.enabled).toBe(false);
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
    const stored = pickEditable({ ...DEFAULT_SETTINGS, scan: { ...DEFAULT_SETTINGS.scan, enabled: true, stepMs: 3500 } });
    const loaded = mergeSettings(stored);
    expect(loaded.scan).toMatchObject({ enabled: true, stepMs: 3500, startExtraMs: DEFAULT_SETTINGS.scan.startExtraMs });
  });

  it('rejects a step time outside its range', () => {
    const bad = { ...DEFAULT_SETTINGS, scan: { ...DEFAULT_SETTINGS.scan, stepMs: 200 } };
    expect(validateSettings(bad)).toContainEqual({ code: 'invalid', path: 'scan.stepMs' });
  });
});

import { tileSpeech, announceStep } from '../src/ui/scan-audio.js';
import { spellerTiles, createSpellerState } from '../src/ui/speller-controller.js';

describe('audio scan', () => {
  it('says a tile by its label and spells out a letter group', () => {
    expect(tileSpeech({ label: 'Keperluan', icon: '🙋' })).toBe('Keperluan');
    const groups = spellerTiles(createSpellerState()).filter((t) => t.group !== undefined);
    expect(tileSpeech(groups[0])).toBe('A, B, C, D, E');
    expect(tileSpeech(groups[4])).toBe('U, V, W, Y, Z');
    expect(tileSpeech({ label: 'K', letter: 'K' })).toBe('K');
  });

  it('announces a new tile once, not on every check', () => {
    let last = null;
    const heard = [];
    for (const key of ['home:0', 'home:0', 'home:0', 'home:1', 'home:1', 'home:2']) {
      const out = announceStep(last, { enabled: true, live: true, key });
      last = out.lastKey;
      if (out.announce) heard.push(key);
    }
    expect(heard).toEqual(['home:0', 'home:1', 'home:2']);
  });

  it('stays silent when off or not live, and re-announces the tile when live again', () => {
    expect(announceStep(null, { enabled: false, live: true, key: 'a' }).announce).toBe(false);
    const away = announceStep('a', { enabled: true, live: false, key: 'a' });
    expect(away).toEqual({ lastKey: null, announce: false });
    expect(announceStep(away.lastKey, { enabled: true, live: true, key: 'a' }).announce).toBe(true);
  });

  it('audio scan is off by default and saved as an editable setting', () => {
    expect(DEFAULT_SETTINGS.scan.speakTiles).toBe(false);
    const stored = pickEditable({ ...DEFAULT_SETTINGS, scan: { ...DEFAULT_SETTINGS.scan, speakTiles: true } });
    expect(mergeSettings(stored).scan.speakTiles).toBe(true);
  });
});
