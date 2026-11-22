// Backup file: settings + phrases + calibration in one JSON file, so a setup
// can be restored after clearing the browser or moved to another laptop.
// Pure: building and checking the data. The UI handles download/upload.
import { pickEditable, mergeSettings, validateSettings } from './settings-store.js';
import { isValidCalibration } from './calibration-store.js';
import { validateBoards } from '../ui/board-controller.js';
import { DEFAULT_SETTINGS } from './default-settings.js';

export const BACKUP_FORMAT = 'woca-backup';
export const BACKUP_VERSION = 1;

export function makeBackup({ settings, boards, calibration }, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    savedAt: now.toISOString(),
    settings: pickEditable(settings),
    boards,
    calibration,
  };
}

/** File name like "woca-sandaran-2026-11-22.json". */
export const backupFileName = (backup) => `woca-sandaran-${backup.savedAt.slice(0, 10)}.json`;

/**
 * Check a backup file's text.
 * @returns {{ok: true, settings, boards, calibration} | {ok: false, reason: 'notJson'|'notBackup'|'invalid'}}
 */
export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (data?.format !== BACKUP_FORMAT || data.version !== BACKUP_VERSION) return { ok: false, reason: 'notBackup' };

  const settings = mergeSettings(data.settings ?? {});
  const boardsOk = Array.isArray(data.boards) && validateBoards(data.boards, DEFAULT_SETTINGS.board).length === 0;
  const calibrationOk = isValidCalibration(data.calibration);
  if (validateSettings(settings).length || !boardsOk || !calibrationOk) return { ok: false, reason: 'invalid' };

  return { ok: true, settings, boards: data.boards, calibration: data.calibration };
}
