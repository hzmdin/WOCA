// Settings screen (key S): tabs for movements, sensitivity, voice, phrases and
// backup. Edits go into a draft; "Simpan" validates, saves, and reloads the page
// so every part of WOCA starts cleanly with the new settings.
import { STRINGS } from './strings-ms.js';
import { renderFields, showFieldErrors } from './settings-fields.js';
import { renderPhrasesEditor } from './phrases-editor.js';
import { validateBoards } from './board-controller.js';
import { EVENTS, setPath, validateSettings, saveSettings, clearSettings } from '../storage/settings-store.js';
import { saveBoards, clearBoards } from '../storage/boards-store.js';
import { saveCalibration } from '../storage/calibration-store.js';
import { makeBackup, readBackup, backupFileName } from '../storage/backup.js';

const S = STRINGS.settings;
const RELOAD_DELAY_MS = 700;

const TAB_FIELDS = {
  gestures: [...EVENTS.map((e) => `gestureMap.${e}`), 'expressionGuard.enabled'],
  timing: ['thresholdPct', 'closedThresholdPct', 'holdMs', 'cooldownMs', 'longBlinkMs', 'eventHoldMs.HELP', 'board.yesSide', 'board.tileColors', 'board.returnHomeMs', 'breakReminder.afterMin'],
  voice: ['voice.name', 'voice.rate', 'help.volume'],
};
const TABS = ['gestures', 'timing', 'voice', 'phrases', 'backup'];

function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const reloadSoon = () => setTimeout(() => location.reload(), RELOAD_DELAY_MS);

/** @param opts { config, getBoards(), getVoices() } */
export function createSettingsScreen({ config, getBoards, getVoices }) {
  const el = document.createElement('div');
  el.className = 'settings';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="settings-card">
      <h2>${S.title}</h2>
      <nav class="settings-tabs">${TABS.map((t) => `<button type="button" data-tab="${t}">${S.tabs[t]}</button>`).join('')}</nav>
      ${TABS.map((t) => `<div class="settings-panel" data-panel="${t}" hidden></div>`).join('')}
      <p class="settings-status" role="status"></p>
      <div class="settings-actions">
        <button type="button" class="big-button" data-action="save">${S.save}</button>
        <button type="button" class="big-button secondary" data-action="cancel">${S.cancel}</button>
        <button type="button" class="big-button secondary" data-action="reset">${S.reset}</button>
      </div>
    </div>`;
  document.body.append(el);

  const panel = (t) => el.querySelector(`[data-panel="${t}"]`);
  const statusEl = el.querySelector('.settings-status');
  let draftSettings = null;
  let draftBoards = null;

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }

  function showTab(tab) {
    for (const t of TABS) {
      panel(t).hidden = t !== tab;
      el.querySelector(`[data-tab="${t}"]`).classList.toggle('active', t === tab);
    }
  }

  function renderBackup() {
    const p = panel('backup');
    p.innerHTML = `
      <p>${S.backup.note}</p>
      <button type="button" class="big-button secondary" data-backup="export">${S.backup.export}</button>
      <label class="big-button secondary file-button">${S.backup.import}<input type="file" accept=".json,application/json" hidden></label>`;
    p.querySelector('[data-backup="export"]').addEventListener('click', () => {
      const backup = makeBackup({ settings: config.settings, boards: getBoards(), calibration: config.calibration });
      download(backupFileName(backup), backup);
    });
    p.querySelector('input[type="file"]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const r = readBackup(await file.text());
      if (!r.ok) return setStatus(S.backup.importErrors[r.reason], true);
      if (saveSettings(r.settings) && saveBoards(r.boards) && saveCalibration(r.calibration)) {
        setStatus(S.backup.importOk);
        reloadSoon();
      } else setStatus(S.errors.saveFailed, true);
    });
  }

  function save() {
    const errors = validateSettings(draftSettings);
    const boardErrors = validateBoards(draftBoards, config.settings.board);
    for (const t of Object.keys(TAB_FIELDS)) showFieldErrors(panel(t), errors);
    if (errors.length) {
      const firstTab = Object.keys(TAB_FIELDS).find((t) => TAB_FIELDS[t].includes(errors[0].path));
      showTab(firstTab ?? 'gestures');
      return setStatus(S.errors[errors[0].code], true);
    }
    if (boardErrors.length) {
      showTab('phrases');
      return setStatus(S.errors.boards, true);
    }
    if (saveSettings(draftSettings) && saveBoards(draftBoards)) {
      setStatus(S.savedReload);
      reloadSoon();
    } else setStatus(S.errors.saveFailed, true);
  }

  const close = () => (el.hidden = true);

  el.querySelector('.settings-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t) showTab(t);
  });
  el.querySelector('[data-action="save"]').addEventListener('click', save);
  el.querySelector('[data-action="cancel"]').addEventListener('click', close);
  el.querySelector('[data-action="reset"]').addEventListener('click', () => {
    if (!window.confirm(S.resetConfirm)) return;
    clearSettings();
    clearBoards();
    setStatus(S.savedReload);
    reloadSoon();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close();
  });

  return {
    isOpen: () => !el.hidden,

    open() {
      draftSettings = config.settings;
      draftBoards = JSON.parse(JSON.stringify(getBoards()));
      const opts = {
        getDraft: () => draftSettings,
        setValue: (path, value) => (draftSettings = setPath(draftSettings, path, value)),
        voices: getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ms')),
      };
      for (const [t, paths] of Object.entries(TAB_FIELDS)) {
        const p = panel(t);
        p.replaceWith(p.cloneNode(false)); // drop old listeners
        renderFields(panel(t), paths, opts);
      }
      panel('gestures').insertAdjacentHTML('beforeend', `<p class="settings-note">${S.rowNote}</p><p class="settings-note">${S.recalibrateNote}</p>`);
      renderPhrasesEditor(panel('phrases'), {
        getBoards: () => draftBoards,
        setBoards: (b) => (draftBoards = b),
        maxTiles: config.settings.board.maxTiles,
      });
      renderBackup();
      setStatus('');
      showTab('gestures');
      el.hidden = false;
    },
  };
}
