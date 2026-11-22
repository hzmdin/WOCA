// Entry point: wires modules together (see docs/infrastructure.md).
import './style.css';
import { registerServiceWorker } from './pwa.js';
import { STRINGS } from './ui/strings-ms.js';
import { startCamera } from './vision/camera.js';
import { createFaceTracker } from './vision/face-tracker.js';
import { createDebugPanel } from './ui/debug-panel.js';
import { createRecorderPanel } from './ui/recorder-panel.js';
import { createCaregiverControls } from './ui/caregiver-controls.js';
import { createEngineState, stepEngine, setPaused } from './gestures/gesture-engine.js';
import { createDriftState, stepDrift } from './gestures/recentre.js';
import { createSpeaker } from './speech/speaker.js';
import { createChime } from './speech/chime.js';
import { createCallForHelp } from './ui/call-for-help.js';
import { createBoardScreen } from './ui/board-screen.js';
import { createStatusBanners } from './ui/status-banners.js';
import { createSettingsScreen } from './ui/settings-screen.js';
import { loadSettings } from './storage/settings-store.js';
import { loadBoards } from './storage/boards-store.js';
import { loadCalibration } from './storage/calibration-store.js';
import { createWordPredictor } from './storage/word-history.js';

// Saved settings/phrases (or defaults). Saving settings reloads the page;
// config.calibration is replaced live by calibration/re-centre.
const config = { settings: loadSettings(), calibration: loadCalibration() };
const boards = loadBoards();
let engineState = createEngineState(config.settings.gestureMap);
let driftState = createDriftState();

/** Fresh engine (nothing half-held carries over), keeping the pause state. */
function resetEngine() {
  engineState = createEngineState(config.settings.gestureMap, { paused: engineState.paused });
  driftState = createDriftState();
}

const app = document.querySelector('#app');
app.innerHTML = `
  <h1>${STRINGS.appTitle}</h1>
  <main id="board"></main>
  <div class="workspace">
    <div class="camera-column">
      <div class="camera-frame">
        <video id="camera" playsinline muted></video>
      </div>
      <p id="status" class="status" role="status">${STRINGS.cameraStarting}</p>
      <p id="face-status" class="status"></p>
      <button id="retry" class="big-button" hidden>${STRINGS.retry}</button>
      <div id="caregiver"></div>
    </div>
    <aside id="debug"></aside>
  </div>
  <div id="paused-overlay" class="paused-overlay" role="status" hidden>
    <p class="paused-title">${STRINGS.paused}</p>
    <p class="paused-hint">${config.settings.gestureMap.PAUSE ? STRINGS.pausedHint : ''}</p>
    <p class="paused-hint small">${STRINGS.pausedHintCaregiver}</p>
  </div>
  <div id="start-overlay" class="start-overlay">
    <button id="start" class="big-button" type="button">${STRINGS.start.button}</button>
    <p class="status small">${STRINGS.start.hint}</p>
  </div>
`;

const video = app.querySelector('#camera');
const statusEl = app.querySelector('#status');
const faceStatusEl = app.querySelector('#face-status');
const retryBtn = app.querySelector('#retry');
const pausedOverlay = app.querySelector('#paused-overlay');
const debugPanel = createDebugPanel(app.querySelector('#debug'), config);
const recorderPanel = createRecorderPanel(app.querySelector('#debug'));

function showPaused(paused) {
  if (pausedOverlay.hidden === !paused) return;
  pausedOverlay.hidden = !paused;
  console.log('[woca]', paused ? 'paused' : 'resumed');
}

const speaker = createSpeaker({ getVoiceSettings: () => config.settings.voice });
const chime = createChime();

// Call for help: repeating alarm + spoken call until the caregiver dismisses it.
const help = createCallForHelp({
  config,
  chime,
  speaker,
  onDismissed: resetEngine, // nothing half-held while the alarm rang fires afterwards
});

const caregiver = createCaregiverControls(app.querySelector('#caregiver'), {
  config,
  onCalibrationChanged: resetEngine,
  onTogglePause() {
    engineState = setPaused(engineState, !engineState.paused);
    showPaused(engineState.paused);
  },
  speaker,
  onOpenSettings: () => settingsScreen.open(),
  isBlocked: () => help.isActive() || settingsScreen.isOpen(),
});
const settingsScreen = createSettingsScreen({ config, getBoards: () => boards, getVoices: () => speaker.voices() });

// Start screen: one click (or Enter) unlocks sound for the whole session.
const startOverlay = app.querySelector('#start-overlay');
const started = () => startOverlay.hidden;
app.querySelector('#start').addEventListener('click', () => {
  chime.unlock();
  startOverlay.hidden = true;
});
app.querySelector('#start').focus();

const board = createBoardScreen(app.querySelector('#board'), {
  config,
  getBoards: () => boards,
  speaker,
  chime,
  predictor: createWordPredictor({ getOptions: () => config.settings.speller }),
  isBlocked: () => !started() || caregiver.busy() || help.isActive() || settingsScreen.isOpen(),
  onAlert: () => help.start(),
});
// After the board: the board view replaces its container's contents when it is created.
const banners = createStatusBanners(app.querySelector('#board'), { getSettings: () => config.settings });

// Start loading the model right away, in parallel with the camera.
const trackerPromise = createFaceTracker()
  .then((tracker) => {
    console.info(`[woca] face model ready (${tracker.delegate})`);
    faceStatusEl.textContent = STRINGS.modelReady;
    return tracker;
  })
  .catch((error) => {
    console.error('[woca] face model failed to load', error);
    faceStatusEl.textContent = STRINGS.modelFailed;
    faceStatusEl.classList.add('error');
    return null;
  });
faceStatusEl.textContent = STRINGS.modelLoading;

let trackingStarted = false;

async function openCamera() {
  retryBtn.hidden = true;
  statusEl.classList.remove('error');
  statusEl.textContent = STRINGS.cameraStarting;

  const result = await startCamera(video);
  if (!result.ok) {
    statusEl.textContent = STRINGS.cameraErrors[result.code] ?? STRINGS.cameraErrors.unknown;
    statusEl.classList.add('error');
    retryBtn.hidden = false;
    return;
  }
  statusEl.textContent = STRINGS.cameraOn;

  const tracker = await trackerPromise;
  if (tracker && !trackingStarted) {
    trackingStarted = true;
    runTrackingLoop(tracker);
  }
}

function runTrackingLoop(tracker) {
  const onFrame = (now) => {
    if (video.readyState >= 2) {
      const signals = tracker.detect(video, now);
      faceStatusEl.textContent = signals.faceFound ? STRINGS.faceVisible : STRINGS.faceNotVisible;
      faceStatusEl.classList.toggle('error', !signals.faceFound);
      if (caregiver.busy()) {
        // Calibrating or re-centring: no gesture events.
        caregiver.feed(signals);
        board.setProgress({});
        debugPanel.update(signals, null);
      } else {
        const engineOut = stepEngine(engineState, signals, config);
        engineState = engineOut.state;
        for (const ev of engineOut.events) {
          console.log('[woca] event', ev.type);
          if (ev.type === 'HELP') help.start();
          // While the alarm rings, gestures do nothing: only the caregiver stops it.
          else if (ev.type !== 'PAUSE' && started() && !help.isActive() && !settingsScreen.isOpen()) board.handleEvent(ev.type);
        }
        board.setProgress(engineOut.paused || !started() ? {} : engineOut.progress);
        banners.update(signals, { paused: engineOut.paused });
        showPaused(engineOut.paused);
        const drift = stepDrift(driftState, signals, engineOut, config);
        driftState = drift.state;
        caregiver.showRecentreHint(drift.suggest);
        debugPanel.update(signals, engineOut);
        recorderPanel.feed(signals);
      }
    }
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);
}

retryBtn.addEventListener('click', openCamera);
openCamera();
registerServiceWorker();
