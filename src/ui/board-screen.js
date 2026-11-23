// Connects the board controller, speller, view, speech and keyboard.
// Events come from the user's gestures (via main.js) or the caregiver's keyboard:
//   ← → ↑ ↓ = move   Enter / Space = select   Backspace = back
import { createBoardState, boardStep, isYesNo } from './board-controller.js';
import { createBoardView } from './board-view.js';
import { createSpellerState, spellerStep, currentPrefix } from './speller-controller.js';

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

  const opts = () => ({ yesSide: config.settings.board.yesSide, colors: config.settings.board.tileColors });

  const view = createBoardView(container, {
    onTileClick(index) {
      // On Yes/No, clicking a half answers it (left half = LEFT).
      if (!speller && isYesNo(getBoards(), state.boardId)) return handleEvent(index === 0 ? 'LEFT' : 'RIGHT');
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
    await speaker.speak(action.text, { audio: action.audio });
    if (action.stay) return; // Yes/No: stay for the next question
    // Back to Home after a pause, unless the user has moved on meanwhile.
    clearTimeout(homeTimer);
    homeTimer = setTimeout(() => {
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
    if (type !== 'HOME') clearTimeout(homeTimer);
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

  render();

  return {
    handleEvent,
    setProgress: (progress) => view.setProgress(progress),
  };
}
