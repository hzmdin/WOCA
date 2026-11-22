// Developer-only controls to record a fixture: pick a label, press Record,
// 3s countdown to get into position, 10s of recording, then the JSON file
// downloads. Move it into tests/fixtures/. English on purpose (the user never sees it).
import { RECORDING_LABELS, RECORD_MS, createRecording, fixtureFileName } from '../vision/recorder.js';

const COUNTDOWN_MS = 3000;

function download(fixture) {
  const blob = new Blob([JSON.stringify(fixture)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fixtureFileName(fixture);
  a.click();
  URL.revokeObjectURL(url);
}

export function createRecorderPanel(container) {
  const section = document.createElement('div');
  section.className = 'recorder';
  section.innerHTML = `
    <div class="debug-head debug-section">Recorder <small>(numbers only, no video)</small></div>
    <div class="recorder-controls">
      <select class="recorder-label">
        ${Object.keys(RECORDING_LABELS).map((l) => `<option value="${l}">${l}</option>`).join('')}
      </select>
      <button class="recorder-button" type="button">Record ${RECORD_MS / 1000}s</button>
    </div>
    <p class="recorder-hint"></p>
    <p class="recorder-status" role="status"></p>
  `;
  container.append(section);

  const select = section.querySelector('.recorder-label');
  const button = section.querySelector('.recorder-button');
  const hint = section.querySelector('.recorder-hint');
  const status = section.querySelector('.recorder-status');

  const showHint = () => (hint.textContent = RECORDING_LABELS[select.value]);
  select.addEventListener('change', showHint);
  showHint();

  // phase: idle -> countdown -> recording -> idle
  let phase = 'idle';
  let countdownStart = null;
  let recording = null;

  button.addEventListener('click', () => {
    if (phase !== 'idle') return;
    phase = 'countdown';
    countdownStart = null;
    button.disabled = select.disabled = true;
    status.textContent = 'Get ready…';
  });

  function done(fixture) {
    phase = 'idle';
    button.disabled = select.disabled = false;
    download(fixture);
    status.textContent = `Saved ${fixtureFileName(fixture)} (${fixture.frameCount} frames). Move it to tests/fixtures/.`;
  }

  return {
    /** Call every frame with the latest FaceSignals. */
    feed(signals) {
      if (phase === 'countdown') {
        countdownStart ??= signals.t;
        const left = COUNTDOWN_MS - (signals.t - countdownStart);
        if (left > 0) {
          status.textContent = `Starting in ${Math.ceil(left / 1000)}…`;
          return;
        }
        phase = 'recording';
        recording = createRecording(select.value);
      }
      if (phase === 'recording') {
        if (recording.add(signals)) {
          const secs = Math.ceil((RECORD_MS - recording.elapsedMs()) / 1000);
          status.textContent = `● REC ${select.value}: ${secs}s`;
        } else {
          done(recording.finish());
        }
      }
    },
  };
}
