// Form rows for editable settings (gesture selects, sliders, toggles, voice).
// Rows write straight into the draft via setValue; validation happens on Save.
import { STRINGS } from './strings-ms.js';
import { EDITABLE, getPath } from '../storage/settings-store.js';
import { AVAILABLE_GESTURES } from '../storage/default-settings.js';

const S = STRINGS.settings;
const fieldFor = (path) => EDITABLE.find((f) => f.path === path);

/** Friendly display of a number setting. */
export function formatValue(path, v) {
  if (path === 'thresholdPct' || path === 'closedThresholdPct' || path === 'help.volume') return `${Math.round(v * 100)}%`;
  if (path === 'voice.rate') return `${v.toFixed(2)}×`;
  if (path === 'breakReminder.afterMin') return `${v} min`;
  if (/Ms(\.|$)|\.HELP$/.test(path)) return `${(v / 1000).toFixed(1)} s`;
  return String(v);
}

function control(field, value, voices) {
  switch (field.type) {
    case 'gesture':
      return `<select data-path="${field.path}">
        <option value="">${S.none}</option>
        ${AVAILABLE_GESTURES.map((g) => `<option value="${g}"${g === value ? ' selected' : ''}>${S.gestures[g]}</option>`).join('')}
      </select>`;
    case 'number':
      return `<input type="range" data-path="${field.path}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}">
        <output>${formatValue(field.path, value)}</output>`;
    case 'bool':
      return `<input type="checkbox" data-path="${field.path}"${value ? ' checked' : ''}>`;
    case 'side':
      return `<select data-path="${field.path}">
        ${['left', 'right'].map((s) => `<option value="${s}"${s === value ? ' selected' : ''}>${S.sides[s]}</option>`).join('')}
      </select>`;
    case 'voice':
      return `<select data-path="${field.path}">
        <option value="">${S.voiceAuto}</option>
        ${voices.map((v) => `<option${v.name === value ? ' selected' : ''}></option>`).join('')}
      </select>`;
    default:
      return '';
  }
}

const labelFor = (path) =>
  path.startsWith('gestureMap.') ? S.events[path.slice('gestureMap.'.length)] : S.fields[path];

/**
 * Render rows for the given setting paths.
 * @param opts { getDraft(), setValue(path, value), voices: SpeechSynthesisVoice[] }
 */
export function renderFields(container, paths, { getDraft, setValue, voices = [] }) {
  container.innerHTML = paths
    .map((path) => {
      const field = fieldFor(path);
      return `<div class="setting-row" data-row="${path}">
        <label>${labelFor(path)}</label>
        <span class="setting-control">${control(field, getPath(getDraft(), path), voices)}</span>
        <span class="setting-error" role="alert"></span>
      </div>`;
    })
    .join('');

  // Voice names come from the system: set as text, never as HTML.
  container.querySelectorAll('[data-path="voice.name"] option:not([value=""])').forEach((opt, i) => {
    opt.value = voices[i].name;
    opt.textContent = voices[i].name;
  });

  container.addEventListener('input', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    const field = fieldFor(el.dataset.path);
    let value;
    if (field.type === 'number') {
      value = Number(el.value);
      el.nextElementSibling.textContent = formatValue(field.path, value);
    } else if (field.type === 'bool') value = el.checked;
    else value = el.value === '' ? null : el.value;
    setValue(field.path, value);
  });
}

/** Show validation errors next to their rows; returns true if any were shown here. */
export function showFieldErrors(container, errors) {
  container.querySelectorAll('.setting-error').forEach((el) => (el.textContent = ''));
  let shown = false;
  for (const err of errors) {
    const el = container.querySelector(`[data-row="${err.path}"] .setting-error`);
    if (el) {
      el.textContent = S.errors[err.code];
      shown = true;
    }
  }
  return shown;
}
