// Banners drawn over the board: "Wajah tidak kelihatan" (face lost) and the
// gentle "Rehat sekejap?" break reminder. Timing logic is in status-watch.js.
import { STRINGS } from './strings-ms.js';
import { createFaceLostState, stepFaceLost, createBreakState, stepBreak } from './status-watch.js';

/**
 * @param boardEl the board container (banners are positioned over it)
 * @param opts { getSettings() }
 */
export function createStatusBanners(boardEl, { getSettings }) {
  const faceEl = document.createElement('div');
  faceEl.className = 'banner banner-face';
  faceEl.hidden = true;
  faceEl.setAttribute('role', 'status');
  faceEl.innerHTML = `
    <p class="banner-title">${STRINGS.faceNotVisible}</p>
    <p class="banner-hint">${STRINGS.faceLostHint}</p>`;

  const breakEl = document.createElement('div');
  breakEl.className = 'banner banner-break';
  breakEl.hidden = true;
  breakEl.setAttribute('role', 'status');
  breakEl.innerHTML = `
    <p class="banner-title">☕ ${STRINGS.breakTitle}</p>
    <p class="banner-hint">${STRINGS.breakHint}</p>`;

  boardEl.append(faceEl, breakEl);

  let faceState = createFaceLostState();
  let breakState = createBreakState();

  return {
    /** Call every frame (when not calibrating/re-centring). */
    update(signals, { paused }) {
      const settings = getSettings();
      const face = stepFaceLost(faceState, signals, settings);
      faceState = face.state;
      const brk = stepBreak(breakState, signals.t, { paused, faceFound: signals.faceFound }, settings);
      breakState = brk.state;
      faceEl.hidden = !face.show;
      breakEl.hidden = !brk.show || face.show; // face-lost matters more
    },
  };
}
