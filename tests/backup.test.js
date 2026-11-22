import { describe, it, expect } from 'vitest';
import { makeBackup, readBackup, backupFileName } from '../src/storage/backup.js';
import { setPath } from '../src/storage/settings-store.js';
import { updateTile } from '../src/storage/boards-store.js';
import { DEFAULT_SETTINGS, DEFAULT_CALIBRATION } from '../src/storage/default-settings.js';
import { DEFAULT_BOARDS } from '../src/storage/default-boards.js';

const everything = {
  settings: setPath(DEFAULT_SETTINGS, 'holdMs', 900),
  boards: updateTile(DEFAULT_BOARDS, 'needs', 0, { say: 'Saya haus.' }),
  calibration: { ...DEFAULT_CALIBRATION, neutral: { yaw: 4, pitch: -12, roll: 0 }, createdAt: '2026-11-22T10:00:00.000Z' },
};

describe('backup', () => {
  it('round-trips settings, phrases and calibration', () => {
    const text = JSON.stringify(makeBackup(everything, new Date('2026-11-22T12:00:00Z')));
    const r = readBackup(text);
    expect(r.ok).toBe(true);
    expect(r.settings.holdMs).toBe(900);
    expect(r.boards.find((b) => b.id === 'needs').tiles[0].say).toBe('Saya haus.');
    expect(r.calibration.neutral.pitch).toBe(-12);
  });

  it('only stores editable settings in the file', () => {
    const b = makeBackup(everything);
    expect(b.settings.releasePct).toBeUndefined();
    expect(b.settings.holdMs).toBe(900);
  });

  it('has a dated, Windows-safe file name', () => {
    expect(backupFileName(makeBackup(everything, new Date('2026-11-22T12:00:00Z')))).toBe('woca-sandaran-2026-11-22.json');
  });

  it('rejects files that are not JSON, not a WOCA backup, or broken', () => {
    expect(readBackup('hello')).toEqual({ ok: false, reason: 'notJson' });
    expect(readBackup('{"label":"laugh"}')).toEqual({ ok: false, reason: 'notBackup' }); // e.g. a fixture file
    const bad = { ...makeBackup(everything), boards: [{ id: 'home', tiles: [] }] };
    expect(readBackup(JSON.stringify(bad))).toEqual({ ok: false, reason: 'invalid' });
  });
});
