// Connects the board controller, speller, view, speech and keyboard.
// Events come from the user's gestures (via main.js) or the caregiver's keyboard:
//   ← → ↑ ↓ = move   Enter / Space = select   Backspace = back
import { createBoardState, boardStep, isYesNo, tilesOf } from './board-controller.js';
import { createBoardView } from './board-view.js';
import { createSpellerState, spellerStep, currentPrefix, spellerTiles } from './speller-controller.js';
import { createScanState, scanStep } from './scan-timer.js';
import { tileSpeech, announceStep } from './scan-audio.js';

const SCAN_TICK_MS = 100; // how often the scan timer is checked (not a gesture threshold)

const KEY_EVENTS = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  Enter: 'SELECT',
  ' ': 'SELECT',
  Backspace: 'BACK',
};

/**
 * @param container element for the board
 * @param opts { config, getBoards(), speaker, chime, predictor, isBlocked(), onAlert() }
 *   predictor: { suggest(prefix), learn(text) } word prediction for the speller
 *   isBlocked: true while keyboard input must be ignored (wizard open, start screen)
 *   onAlert:   the "Tolong!" tile was selected
 */
export function createBoardScreen(container, { config, getBoards, speaker, chime, predictor, isBlocked, onAlert }) {
  let state = createBoardState();
  let speller = null; // speller state while the speller is open, else null
  let homeTimer = null;
  // Auto-scan bookkeeping (see scan-timer.js)
  let scanState = createScanState();
  let inputLive = false; // set by main.js each frame: not paused, face visible
  let selectProgress = 0; // 0..1 hold of SELECT; the highlight must not move while > 0
  let speaking = false; // don't move the highlight while a phrase is being spoken
  let lastAnnounced = null; // audio scan: screen+tile already said aloud

  const opts = () => ({
    yesSide: config.settings.board.yesSide,
    colors: config.settings.board.tileColors,
    scan: config.settings.scan.enabled,
    pageSize: config.settings.board.simpleMode ? config.settings.board.simplePageSize : null,
  });

  const view = createBoardView(container, {
    onTileClick(index) {
      // On Yes/No, clicking a half answers it (left half = LEFT).
      if (!speller && !opts().scan && isYesNo(getBoards(), state.boardId)) return handleEvent(index === 0 ? 'LEFT' : 'RIGHT');
      if (speller) speller = { ...speller, index };
      else state = { ...state, index };
      render(); // show the clicked tile as highlighted
      handleEvent('SELECT');
    },
  });

  const suggestions = () => predictor.suggest(currentPrefix(speller));
  const render = () => (speller ? view.renderSpeller(speller, suggestions(), opts()) : view.render(getBoards(), state, opts()));

  async function speak(action) {
    chime.play();
    view.showSpoken(action.text);
    speaking = true;
    await speaker.speak(action.text, { audio: action.audio });
    if (action.stay) {
      speaking = false;
      return; // Yes/No: stay for the next question
    }
    // Back to Home after a pause, unless the user has moved on meanwhile.
    clearTimeout(homeTimer);
    homeTimer = setTimeout(() => {
      speaking = false;
      handleEvent('HOME');
      view.showSpoken('');
    }, config.settings.board.returnHomeMs);
  }

  /** Speller open: events go to the speller instead of the board. */
  function spellerEvent(type) {
    const out = spellerStep(speller, type, suggestions());
    speller = out.state;
    if (out.action?.type === 'typed') chime.play();
    if (out.action?.type === 'speak') {
      predictor.learn(out.action.text); // The user's words rank higher next time
      speak({ ...out.action, stay: true });
    }
    if (out.action?.type === 'exit') {
      speller = null;
      view.showSpoken('');
    }
    render();
  }

  /** Apply one event: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'SELECT' | 'BACK' | 'HOME' */
  function handleEvent(type) {
    if (type !== 'HOME') {
      clearTimeout(homeTimer);
      speaking = false;
    }
    // After the user acts, the scan starts over with extra time on the new tile.
    if (type === 'SELECT' || type === 'BACK' || type === 'HOME') scanState = createScanState();
    if (speller) return type === 'HOME' ? undefined : spellerEvent(type);
    const before = state;
    const out = boardStep(state, type, getBoards(), opts());
    state = out.state;
    if (out.state !== before) render();
    if (out.action?.type === 'navigate') view.showSpoken('');
    if (out.action?.type === 'speak') speak(out.action);
    if (out.action?.type === 'alert') onAlert();
    if (out.action?.type === 'speller') {
      speller = createSpellerState();
      view.showSpoken('');
      render();
    }
  }

  document.addEventListener('keydown', (e) => {
    const type = KEY_EVENTS[e.key];
    if (!type || isBlocked() || ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    // Enter/Space on a focused button already "clicks" it; don't select a tile too.
    if (type === 'SELECT' && e.target.tagName === 'BUTTON') return;
    e.preventDefault(); // Space/arrows must not scroll the page
    handleEvent(type);
  });

  // Auto-scan: a timer moves the highlight; everything else (hold, pause, face lost) only stops it.
  setInterval(() => {
    if (!config.settings.scan.enabled) return;
    const screen = () => (speller ? `speller:${speller.level}:${speller.group}` : `board:${state.boardId}`);
    const index = () => (speller ? speller.index : state.index);
    const live = inputLive && !isBlocked() && !speaking;
    const out = scanStep(
      scanState,
      { now: performance.now(), live, holding: selectProgress > 0, screen: screen(), index: index() },
      config.settings.scan
    );
    scanState = out.state;
    if (out.advance) handleEvent('RIGHT');
    // Audio scan: say the tile the highlight is on now (speaking again cuts off the previous one).
    const heard = announceStep(lastAnnounced, {
      enabled: config.settings.scan.speakTiles,
      live,
      key: `${screen()}:${index()}`,
    });
    lastAnnounced = heard.lastKey;
    if (heard.announce) {
      const tiles = speller ? spellerTiles(speller, suggestions()) : tilesOf(getBoards(), state.boardId, opts());
      const tile = tiles[index()];
      if (tile) speaker.speak(tileSpeech(tile));
    }
  }, SCAN_TICK_MS);

  render();

  return {
    handleEvent,
    setProgress(progress) {
      selectProgress = progress.SELECT ?? 0;
      view.setProgress(progress);
    },
    /** Called every frame by main.js: is the user's input trustworthy right now? */
    setInputLive(live) {
      inputLive = live;
    },
  };
}
