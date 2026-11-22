// Caregiver controls: buttons, keyboard shortcuts, calibration wizard and
// re-centre overlay. These always work, even if the user's gestures don't.
//   P = pause/resume   K = calibrate   C = re-centre   T = test voice   S = settings   Esc = cancel
import { STRINGS } from './strings-ms.js';
import { saveCalibration } from '../storage/calibration-store.js';
import { createCalibrationWizard } from './calibration-wizard.js';
import { createRecentreOverlay } from './recentre-overlay.js';

/**
 * @param container element for the buttons and info lines
 * @param opts {
 *   config,                  // { settings, calibration }: calibration is replaced on save
 *   onCalibrationChanged(),  // e.g. reset the gesture engine
 *   onTogglePause(),
 *   speaker,                 // for the voice test (T) and the voice status line
 *   onOpenSettings(),
 *   isBlocked(),             // true while the help alarm or settings screen is showing
 * }
 */
export function createCaregiverControls(
  container,
  { config, onCalibrationChanged, onTogglePause, speaker, onOpenSettings, isBlocked = () => false }
) {
  container.innerHTML = `
    <div class="caregiver-buttons">
      <button data-action="recentre" class="big-button secondary" type="button">${STRINGS.recentre.button}</button>
      <button data-action="calibrate" class="big-button secondary" type="button">${STRINGS.calibration.open} (K)</button>
      <button data-action="voice" class="big-button secondary" type="button">${STRINGS.speech.testButton}</button>
      <button data-action="settings" class="big-button secondary" type="button">${STRINGS.settings.open}</button>
    </div>
    <p class="status small calibration-info"></p>
    <p class="status small voice-info"></p>
  `;
  const calibrationInfoEl = container.querySelector('.calibration-info');
  const voiceInfoEl = container.querySelector('.voice-info');
  const button = (action) => container.querySelector(`[data-action="${action}"]`);
  const onTestVoice = () => speaker.speak(STRINGS.speech.testPhrase);

  function setVoiceInfo(text, isWarning = false) {
    voiceInfoEl.textContent = text;
    voiceInfoEl.classList.toggle('error', isWarning);
  }
  function showVoiceInfo(voice) {
    if (!speaker.available()) setVoiceInfo(STRINGS.speech.noSpeech, true);
    else if (!voice) setVoiceInfo(STRINGS.speech.noMalayVoice, true);
    else if (!voice.localService) setVoiceInfo(STRINGS.speech.voiceOnline(voice.name), true);
    else setVoiceInfo(STRINGS.speech.voiceOffline(voice.name));
  }
  showVoiceInfo(speaker.currentVoice());
  speaker.onVoicesChanged(showVoiceInfo);

  function showCalibrationInfo() {
    const at = config.calibration.createdAt;
    calibrationInfoEl.textContent = at
      ? STRINGS.calibration.lastAt(new Date(at).toLocaleString('ms-MY'))
      : STRINGS.calibration.notCalibrated;
  }
  showCalibrationInfo();

  function applyCalibration(calibration) {
    if (!saveCalibration(calibration)) return false;
    config.calibration = calibration;
    showCalibrationInfo();
    onCalibrationChanged();
    return true;
  }

  const wizard = createCalibrationWizard(document.body, {
    getSettings: () => config.settings,
    getCalibration: () => config.calibration,
    onSave: applyCalibration,
    onClose() {
      onCalibrationChanged();
      button('calibrate').focus();
    },
  });

  const recentreOverlay = createRecentreOverlay(document.body, {
    getSettings: () => config.settings,
    getCalibration: () => config.calibration,
    onDone: applyCalibration,
  });

  const startRecentre = () => {
    if (!wizard.isOpen()) recentreOverlay.start();
  };

  button('calibrate').addEventListener('click', () => wizard.open());
  button('recentre').addEventListener('click', startRecentre);
  button('voice').addEventListener('click', onTestVoice);
  button('settings').addEventListener('click', onOpenSettings);

  document.addEventListener('keydown', (e) => {
    // Never react to letters typed into a form field (e.g. editing a phrase).
    if (wizard.isOpen() || isBlocked() || ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === 'p') onTogglePause();
    else if (key === 'k') wizard.open();
    else if (key === 'c') startRecentre();
    else if (key === 't') onTestVoice();
    else if (key === 's') onOpenSettings();
    else if (key === 'escape') recentreOverlay.cancel();
  });

  return {
    /** True while calibration or re-centre is using the camera frames. */
    busy: () => wizard.isOpen() || recentreOverlay.isActive(),

    /** Pass frames to whichever tool is busy. */
    feed(signals) {
      if (wizard.isOpen()) wizard.feed(signals);
      else recentreOverlay.feed(signals);
    },

    showRecentreHint: (show) => recentreOverlay.showHint(show),
  };
}
