// Full-screen "Call for help" screen. Only the caregiver can close it:
// Space / Enter / Esc, or the big button. It never flashes (AGENTS.md UI rules):
// strong static colours plus the repeating sound do the job.
import { STRINGS } from './strings-ms.js';

const DISMISS_KEYS = new Set([' ', 'Enter', 'Escape']);

/** @param opts { onDismiss() } */
export function createHelpOverlay(root, { onDismiss }) {
  const el = document.createElement('div');
  el.className = 'help-overlay';
  el.hidden = true;
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <p class="help-icon" aria-hidden="true">🆘</p>
    <p class="help-title">${STRINGS.help.title}</p>
    <p class="help-spoken">${STRINGS.help.spoken}</p>
    <button type="button" class="big-button help-dismiss">${STRINGS.help.dismiss}</button>
    <p class="help-hint">${STRINGS.help.hint}</p>
  `;
  root.append(el);
  const button = el.querySelector('.help-dismiss');
  button.addEventListener('click', onDismiss);

  // Capture phase: runs before the board's own key handling.
  document.addEventListener(
    'keydown',
    (e) => {
      if (el.hidden || !DISMISS_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onDismiss();
    },
    true
  );

  return {
    show() {
      el.hidden = false;
      button.focus();
    },
    hide() {
      el.hidden = true;
    },
  };
}
