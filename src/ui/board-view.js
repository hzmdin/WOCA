// Draws a board: big tiles in a grid, the highlighted tile, a progress ring
// while SELECT is held, side arrows that fill while LEFT/RIGHT are held, and
// the last spoken phrase in large text. Yes/No boards are drawn as two
// halves that fill up while the user holds the head turn toward them.
// Render only; no navigation logic.
import { tilesOf, gridColumns, isYesNo } from './board-controller.js';
import { spellerTiles, SPELLER_COLUMNS } from './speller-controller.js';
import { STRINGS } from './strings-ms.js';
import { tileColor, yesNoColor } from './tile-colors.js';

// Labels can be edited by the caregiver later, so never inject raw HTML.
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param container element to draw into
 * @param opts { onTileClick(index) } caregiver can click/tap a tile
 */
export function createBoardView(container, { onTileClick }) {
  container.classList.add('board');
  container.innerHTML = `
    <p class="board-typed" aria-live="polite" hidden></p>
    <div class="board-arrow left" aria-hidden="true"><span class="board-arrow-fill"></span>◀</div>
    <div class="board-grid" role="listbox"></div>
    <div class="board-arrow right" aria-hidden="true"><span class="board-arrow-fill"></span>▶</div>
    <p class="board-spoken" role="status" aria-live="polite"></p>
    <p class="board-hint"></p>
  `;
  const hintEl = container.querySelector('.board-hint');
  const typedEl = container.querySelector('.board-typed');
  const grid = container.querySelector('.board-grid');
  const leftFill = container.querySelector('.board-arrow.left .board-arrow-fill');
  const rightFill = container.querySelector('.board-arrow.right .board-arrow-fill');
  const spokenEl = container.querySelector('.board-spoken');
  let activeTile = null;
  let halves = null; // [left, right] tile elements on a Yes/No board

  // Tiles never take keyboard focus (so Enter always means "select highlighted").
  grid.addEventListener('mousedown', (e) => e.preventDefault());
  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-index]');
    if (tile) onTileClick(Number(tile.dataset.index));
  });

  function drawTiles(tiles, activeIndex, { yesNo, cols, colorOf }) {
    container.classList.toggle('yesno', yesNo);
    grid.style.setProperty('--cols', cols);
    grid.innerHTML = tiles
      .map((t, i) => {
        const color = colorOf?.(t, i);
        return `
      <button type="button" tabindex="-1" class="tile${yesNo ? ' half' : ''}${i === activeIndex ? ' active' : ''}"${color ? ` data-color="${color}"` : ''}
              role="option" aria-selected="${i === activeIndex}" data-index="${i}">
        <span class="tile-fill"></span>
        <span class="tile-ring"></span>
        <span class="tile-icon" aria-hidden="true">${escapeHtml(t.icon)}</span>
        <span class="tile-label">${escapeHtml(t.label)}</span>
      </button>`;
      })
      .join('');
    activeTile = grid.querySelector('.tile.active');
    halves = yesNo ? [...grid.querySelectorAll('.tile')] : null;
  }

  return {
    /**
     * Redraw a board. Call when the board or highlight changes (not every frame).
     * @param opts { yesSide } from settings.board
     */
    render(boards, state, opts = {}) {
      const yesNoBoard = isYesNo(boards, state.boardId);
      const yesNo = yesNoBoard && !opts.scan; // scanning shows Ya / Tidak / Kembali as normal tiles
      const tiles = tilesOf(boards, state.boardId, opts);
      container.classList.toggle('scan', !!opts.scan);
      // On Yes/No nothing is highlighted until the user has answered.
      const colorOf = opts.colors === false ? null : (t, i) => (yesNoBoard && i < 2 ? yesNoColor(i, opts.yesSide) : tileColor(t, state.boardId));
      drawTiles(tiles, yesNo && !state.answered ? -1 : state.index, { yesNo, cols: gridColumns(tiles.length), colorOf });
      typedEl.hidden = true;
      hintEl.textContent = yesNo ? STRINGS.board.yesNoHint : opts.scan ? STRINGS.board.scanHint : '';
    },

    /** Redraw the speller: its level's tiles, the typed text and the suggested words. */
    renderSpeller(state, suggestions = [], opts = {}) {
      const colorOf = opts.colors === false ? null : (t) => tileColor(t, null, state.level === 'letters' ? state.group : null);
      drawTiles(spellerTiles(state, suggestions), state.index, { yesNo: false, cols: SPELLER_COLUMNS, colorOf });
      container.classList.toggle('scan', !!opts.scan);
      typedEl.hidden = false;
      typedEl.classList.toggle('empty', !state.text);
      typedEl.textContent = state.text || STRINGS.speller.empty;
      if (suggestions.length) {
        const hint = document.createElement('span');
        hint.className = 'typed-suggestions';
        hint.textContent = `💡 ${suggestions.join(' · ')}`;
        typedEl.append(hint);
      }
      hintEl.textContent = opts.scan ? STRINGS.board.scanHint : '';
    },

    /** Per-frame hold feedback from the gesture engine (0..1 per event). */
    setProgress(progress = {}) {
      const left = progress.LEFT ?? 0;
      const right = progress.RIGHT ?? 0;
      if (halves) {
        halves[0].style.setProperty('--fill', left);
        halves[1].style.setProperty('--fill', right);
      } else {
        activeTile?.style.setProperty('--p', progress.SELECT ?? 0);
      }
      leftFill.style.height = `${left * 100}%`;
      rightFill.style.height = `${right * 100}%`;
    },

    showSpoken(text) {
      spokenEl.textContent = text ? `🔊 ${text}` : '';
    },
  };
}
