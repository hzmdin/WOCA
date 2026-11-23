// Gesture test screen (key G): full-screen overlay for the caregiver and the user.
// Pick gestures → the user tries each a few times → results and a recommendation.
// Gesture events are NOT processed while it is open (main.js checks busy()).
// The logic is in src/gestures/gesture-test.js; this file only draws it.
import { STRINGS } from './strings-ms.js';
import { createTest, stepTest, skipGesture, summarize, TEST_GESTURES, DEFAULT_TEST_GESTURES } from '../gestures/gesture-test.js';

const S = STRINGS.gestureTest;
const NAMES = STRINGS.settings.gestures;

/**
 * @param root element to put the overlay in
 * @param opts { getSettings(), getCalibration(), onClose() }
 */
export function createGestureTestScreen(root, { getSettings, getCalibration, onClose }) {
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
      <div class="gtest-choices" hidden></div>
      <p class="wizard-status" role="status"></p>
      <div class="wizard-buttons"></div>
    </div>`;
  root.append(el);

  const $ = (sel) => el.querySelector(sel);
  const stepEl = $('.wizard-step');
  const instrEl = $('.wizard-instruction');
  const progressEl = $('.wizard-progress');
  const barEl = $('.wizard-bar');
  const choicesEl = $('.gtest-choices');
  const statusEl = $('.wizard-status');
  const buttonsEl = $('.wizard-buttons');

  let test = null; // running test state, null while choosing or reading results
  let chosen = [...DEFAULT_TEST_GESTURES];
  let lastShown = ''; // avoid rewriting the DOM every frame

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
    test = null;
    onClose?.();
  }

  function showChoices() {
    test = null;
    const calibrated = Boolean(getCalibration().createdAt);
    stepEl.textContent = S.title;
    instrEl.textContent = S.intro;
    instrEl.classList.add('long'); // a paragraph, not a one-line instruction
    progressEl.hidden = true;
    statusEl.textContent = calibrated ? '' : S.calibrateFirst;
    statusEl.classList.toggle('error', !calibrated);
    choicesEl.hidden = false;
    choicesEl.replaceChildren(
      ...TEST_GESTURES.map((g) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = chosen.includes(g);
        box.addEventListener('change', () => {
          chosen = TEST_GESTURES.filter((x) => (x === g ? box.checked : chosen.includes(x)));
        });
        label.append(box, ` ${NAMES[g]}`);
        return label;
      })
    );
    buttons([[S.start, start, true], [S.close, close]]);
  }

  function start() {
    if (!chosen.length) return;
    test = createTest(chosen);
    lastShown = '';
    choicesEl.hidden = true;
    instrEl.classList.remove('long');
    buttons([[S.skip, skip], [S.stop, close]]);
  }

  function skip() {
    if (test) test = skipGesture(test);
    lastShown = '';
  }

  function showResults() {
    const { rows, best } = summarize(test.results, getSettings().gestureTest);
    stepEl.textContent = S.resultsTitle;
    instrEl.textContent = best ? S.recommend(NAMES[best]) : S.noneRecommended;
    progressEl.hidden = true;
    statusEl.classList.remove('error');
    statusEl.textContent = rows
      .map((r) =>
        r.skipped || !r.trials
          ? S.rowSkipped(NAMES[r.gesture])
          : S.row(NAMES[r.gesture], r.hits, r.trials, r.avgMs, r.falseFires, S.ratings[r.rating])
      )
      .join('\n');
    const tested = test.gestures;
    test = null;
    buttons([[S.again, () => { chosen = tested; showChoices(); }, true], [S.close, close]]);
  }

  /** Redraw the running test (only when its text changes). */
  function draw(s, settings) {
    const t = settings.gestureTest;
    const gesture = s.gestures[s.gi];
    const head = S.stepOf(s.gi + 1, s.gestures.length, Math.min(s.trial + 1, t.trials), t.trials);
    let instr = S.now(NAMES[gesture]);
    let status = '';
    if (s.phase === 'intro') {
      instr = S.next(NAMES[gesture]);
      status = S.how[gesture];
    } else if (s.phase === 'rest') {
      instr = S.rest;
      status = s.lastOutcome === 'hit' ? S.hit : s.lastOutcome === 'miss' ? S.miss : '';
    }
    const key = `${head}|${instr}|${status}`;
    if (key === lastShown) return;
    lastShown = key;
    stepEl.textContent = head;
    instrEl.textContent = instr;
    statusEl.textContent = status;
    statusEl.classList.remove('error');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close();
  });

  return {
    isOpen: () => !el.hidden,

    open() {
      el.hidden = false;
      showChoices();
    },

    /** Call every frame with the latest FaceSignals. */
    feed(signals) {
      if (el.hidden || !test) return;
      const settings = getSettings();
      test = stepTest(test, signals, { settings, calibration: getCalibration() });
      if (test.phase === 'done') return showResults();
      draw(test, settings);
      // The bar shows the time used of the current try; hidden while resting.
      progressEl.hidden = test.phase !== 'prompt';
      if (test.phase === 'prompt') {
        barEl.style.width = `${Math.min(100, ((signals.t - test.phaseStart) / settings.gestureTest.promptMs) * 100)}%`;
      }
    },
  };
}
