// Phrase editor: one section per board, one row per tile.
// Speaking tiles: edit icon, name and spoken sentence; add or remove them.
// Navigation / help / Yes-No tiles: name and icon only (their job can't change).
import { STRINGS } from './strings-ms.js';
import { HOME_BOARD } from '../storage/default-boards.js';
import { tilesOf } from './board-controller.js';
import { updateTile, addTile, removeTile } from '../storage/boards-store.js';

const P = STRINGS.settings.phrases;

/** A board's display name: "Utama" for Home, otherwise the label of the tile that opens it. */
function boardTitle(boards, board) {
  if (board.id === HOME_BOARD) return P.home;
  for (const b of boards) for (const t of b.tiles) if (t.goto === board.id) return t.label;
  return board.id;
}

/**
 * @param opts { getBoards(), setBoards(boards), maxTiles }
 */
export function renderPhrasesEditor(container, { getBoards, setBoards, maxTiles }) {
  function render() {
    const boards = getBoards();
    container.innerHTML = '';
    for (const board of boards) {
      const section = document.createElement('section');
      section.className = 'phrase-board';
      const h = document.createElement('h3');
      h.textContent = boardTitle(boards, board);
      section.append(h);

      board.tiles.forEach((tile, index) => {
        const row = document.createElement('div');
        row.className = 'phrase-row';
        row.innerHTML = `
          <input class="phrase-icon" aria-label="${P.icon}" maxlength="4">
          <input class="phrase-label" aria-label="${P.label}">
          ${tile.say ? `<input class="phrase-say" aria-label="${P.say}">` : '<span class="phrase-say"></span>'}
          ${tile.say && board.mode !== 'yesno' && board.tiles.length > 1 ? `<button type="button" class="phrase-remove">${P.remove}</button>` : '<span></span>'}`;
        // Values set as properties (never as HTML) since caregivers type them.
        row.querySelector('.phrase-icon').value = tile.icon ?? '';
        row.querySelector('.phrase-label').value = tile.label;
        if (tile.say) row.querySelector('input.phrase-say').value = tile.say;

        row.addEventListener('input', (e) => {
          const key = { 'phrase-icon': 'icon', 'phrase-label': 'label', 'phrase-say': 'say' }[e.target.className];
          if (key) setBoards(updateTile(getBoards(), board.id, index, { [key]: e.target.value }));
        });
        row.querySelector('.phrase-remove')?.addEventListener('click', () => {
          setBoards(removeTile(getBoards(), board.id, index));
          render();
        });
        section.append(row);
      });

      if (board.mode !== 'yesno') {
        const room = tilesOf(boards, board.id).length < maxTiles;
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'phrase-add';
        add.textContent = room ? P.add : P.full;
        add.disabled = !room;
        add.addEventListener('click', () => {
          setBoards(addTile(getBoards(), board.id));
          render();
        });
        section.append(add);
      }
      container.append(section);
    }
  }
  render();
}
