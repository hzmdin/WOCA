// Re-centre overlay: "look at the screen and keep still" for ~2s, then the
// new resting pose is saved. Also shows the "position changed?" hint.
// Gesture events are NOT processed while measuring (main.js checks isActive()).
import { STRINGS } from './strings-ms.js';
import { recentre } from '../gestures/recentre.js';

const S = STRINGS.recentre;
const RESULT_SHOW_MS = 2500;

/**
 * @param root element to put the overlay and hint in
 * @param opts { getSettings(), getCalibration(), onDone(calibration) -> boolean }
 */
export function createRecentreOverlay(root, { getSettings, getCalibration, onDone }) {
  const el = document.createElement('div');
  el.className = 'recentre';
  el.hidden = true;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <p class="recentre-text"></p>
    <div class="wizard-progress"><span class="wizard-bar"></span></div>`;
  const hintEl = document.createElement('div');
  hintEl.className = 'recentre-hint';
  hintEl.hidden = true;
  hintEl.setAttribute('role', 'status');
  hintEl.textContent = S.hint;
  root.append(el, hintEl);

  const textEl = el.querySelector('.recentre-text');
  const progressEl = el.querySelector('.wizard-progress');
  const barEl = el.querySelector('.wizard-bar');

  let measuring = false;
  let startT = null;
  let frames = [];
  let hideTimer = null;

  function finish(message, isError) {
    measuring = false;
    progressEl.hidden = true;
    textEl.textContent = message;
    el.classList.toggle('error', isError);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (el.hidden = true), RESULT_SHOW_MS);
  }

  return {
    isActive: () => measuring,

    start() {
      clearTimeout(hideTimer);
      measuring = true;
      startT = null;
      frames = [];
      hintEl.hidden = true;
      el.hidden = false;
      el.classList.remove('error');
      progressEl.hidden = false;
      barEl.style.width = '0%';
      textEl.textContent = S.instruction;
    },

    /** Call every frame with the latest FaceSignals while isActive(). */
    feed(signals) {
      if (!measuring) return;
      startT ??= signals.t;
      const elapsed = signals.t - startT;
      const { durationMs } = getSettings().recentre;
      if (elapsed < durationMs) {
        frames.push(signals);
        barEl.style.width = `${Math.min(100, (elapsed / durationMs) * 100)}%`;
        return;
      }
      const result = recentre(getCalibration(), frames, getSettings());
      if (!result.ok) finish(S.failures[result.reason], true);
      else if (!onDone(result.calibration)) finish(S.failures.saveFailed, true);
      else finish(S.done, false);
    },

    /** Esc: stop measuring and close without changing anything. */
    cancel() {
      if (!measuring) return;
      measuring = false;
      el.hidden = true;
    },

    showHint(show) {
      hintEl.hidden = !show || measuring;
    },
  };
}
