// Calibration wizard: a full-screen overlay that walks through
// rest -> each mapped movement, records frames, analyses them, and saves.
// Gesture events are NOT processed while it is open (main.js checks isOpen()).
import { STRINGS } from './strings-ms.js';
import { analyzeRest, analyzeGesture, buildCalibration, calibrationSteps } from '../gestures/calibration.js';

const S = STRINGS.calibration;

/**
 * @param root    element to put the overlay in
 * @param opts    { getSettings(), getCalibration(), onSave(calibration) -> boolean, onClose() }
 */
export function createCalibrationWizard(root, { getSettings, getCalibration, onSave, onClose }) {
  const el = document.createElement('div');
  el.className = 'wizard';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="wizard-card">
      <p class="wizard-step"></p>
      <h2 class="wizard-instruction"></h2>
      <div class="wizard-progress" hidden><span class="wizard-bar"></span></div>
      <p class="wizard-status" role="status"></p>
      <div class="wizard-buttons"></div>
    </div>`;
  root.append(el);

  const stepEl = el.querySelector('.wizard-step');
  const instrEl = el.querySelector('.wizard-instruction');
  const progressEl = el.querySelector('.wizard-progress');
  const barEl = el.querySelector('.wizard-bar');
  const statusEl = el.querySelector('.wizard-status');
  const buttonsEl = el.querySelector('.wizard-buttons');

  // phase: intro | countdown | recording | result | summary
  let phase = 'intro';
  let steps = [];
  let index = 0;
  let phaseStart = null;
  let frames = [];
  let rest = null;
  let results = {};
  let lastResult = null;

  const settings = () => getSettings().calibration;
  const stepKey = () => steps[index];
  const stepMs = () => (stepKey() === 'rest' ? settings().restMs : settings().gestureMs);

  function buttons(list) {
    buttonsEl.replaceChildren(
      ...list.map(([label, onClick, primary]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = primary ? 'big-button' : 'big-button secondary';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
      })
    );
    buttonsEl.querySelector('button')?.focus();
  }

  function close() {
    el.hidden = true;
    onClose?.();
  }

  function beginStep() {
    phase = 'countdown';
    phaseStart = null;
    frames = [];
    stepEl.textContent = S.stepOf(index + 1, steps.length);
    instrEl.textContent = S.steps[stepKey()];
    statusEl.textContent = S.getReady;
    statusEl.classList.remove('error');
    progressEl.hidden = false;
    barEl.style.width = '0%';
    buttons([[S.cancel, close]]);
  }

  function next() {
    index += 1;
    if (index < steps.length) beginStep();
    else showSummary();
  }

  function finishStep() {
    const all = getSettings();
    progressEl.hidden = true;
    if (stepKey() === 'rest') {
      lastResult = analyzeRest(frames, all);
      if (lastResult.ok) rest = lastResult;
    } else {
      lastResult = analyzeGesture(stepKey(), frames, rest, all);
      results[stepKey()] = lastResult;
    }
    phase = 'result';
    if (lastResult.ok) {
      statusEl.classList.remove('error');
      statusEl.textContent = stepKey() === 'rest' ? S.restOk : S.detected(lastResult.reps);
      buttons([[S.next, next, true], [S.retry, beginStep]]);
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = S.failures[lastResult.reason];
      // Rest is required (everything is measured from it); movements can be skipped.
      const list = [[S.retry, beginStep, true]];
      if (stepKey() !== 'rest') list.push([S.skip, () => { results[stepKey()] = undefined; next(); }]);
      list.push([S.cancel, close]);
      buttons(list);
    }
  }

  function showSummary() {
    phase = 'summary';
    stepEl.textContent = S.summary;
    instrEl.textContent = '';
    progressEl.hidden = true;
    statusEl.classList.remove('error');
    const lines = steps
      .filter((k) => k !== 'rest')
      .map((k) => {
        const r = results[k];
        return `${S.labels[k]}: ${r?.ok ? S.detected(r.reps) : S.keptOld}`;
      });
    statusEl.textContent = lines.join('\n');
    buttons([
      [S.save, () => {
        const calibration = buildCalibration(rest, results, getCalibration());
        if (onSave(calibration)) {
          statusEl.textContent = S.saved;
          close();
        } else {
          statusEl.classList.add('error');
          statusEl.textContent = S.saveFailed;
        }
      }, true],
      [S.cancel, close],
    ]);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close();
  });

  return {
    isOpen: () => !el.hidden,

    open() {
      steps = calibrationSteps(getSettings().gestureMap);
      index = 0;
      rest = null;
      results = {};
      phase = 'intro';
      el.hidden = false;
      stepEl.textContent = S.title;
      instrEl.textContent = S.intro;
      statusEl.textContent = '';
      statusEl.classList.remove('error');
      progressEl.hidden = true;
      buttons([[S.start, beginStep, true], [S.cancel, close]]);
    },

    /** Call every frame with the latest FaceSignals. */
    feed(signals) {
      if (el.hidden) return;
      if (phase === 'countdown') {
        phaseStart ??= signals.t;
        const left = settings().countdownMs - (signals.t - phaseStart);
        if (left > 0) {
          statusEl.textContent = `${S.getReady} ${Math.ceil(left / 1000)}`;
          return;
        }
        phase = 'recording';
        phaseStart = signals.t;
      }
      if (phase === 'recording') {
        const elapsed = signals.t - phaseStart;
        if (elapsed < stepMs()) {
          frames.push(signals);
          barEl.style.width = `${Math.min(100, (elapsed / stepMs()) * 100)}%`;
          statusEl.textContent = `● ${S.recording} ${Math.ceil((stepMs() - elapsed) / 1000)}`;
        } else {
          finishStep();
        }
      }
    },
  };
}
