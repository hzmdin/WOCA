// Default boards (Malay). The caregiver will be able to edit these in the
// settings screen (task 3.7). Caregivers: please check the wording.
//
// A tile either goes to another board (`goto`), speaks (`say`, with an
// optional recorded clip `audio` in /public/audio), calls for help
// (`alert: true`, a repeating alarm only the caregiver can stop), or opens the
// speller (`speller: true`, see src/ui/speller-controller.js). Non-home boards get an
// automatic "Kembali" (back) tile, so keep at most 5 tiles on them and at
// most 6 on home: every tile stays big (AGENTS.md: 1/6 of the screen).
//
// A board with `mode: 'yesno'` has exactly two tiles [yes, no] shown as two
// screen halves: a head turn answers straight away (no SELECT needed), and a
// SELECT (long blink) goes back. Which side is "yes" is a setting.

export const HOME_BOARD = 'home';

export const DEFAULT_BOARDS = Object.freeze([
  {
    id: 'home',
    tiles: [
      { label: 'Ya / Tidak', icon: '👍👎', goto: 'yesno' },
      { label: 'Keperluan', icon: '🙋', goto: 'needs' },
      { label: 'Sayang', icon: '❤️', say: 'Saya sayang awak.' },
      { label: 'Terima kasih', icon: '🙏', say: 'Terima kasih.' },
      { label: 'Eja', icon: '🔤', speller: true },
      // Last on purpose: from the first tile, one LEFT (wraps) + SELECT.
      { label: 'Tolong!', icon: '🆘', alert: true },
    ],
  },
  {
    id: 'yesno',
    mode: 'yesno',
    tiles: [
      { label: 'Ya', icon: '👍', say: 'Ya.' },
      { label: 'Tidak', icon: '👎', say: 'Tidak.' },
    ],
  },
  {
    id: 'needs',
    tiles: [
      { label: 'Air', icon: '💧', say: 'Saya nak minum air.' },
      { label: 'Sakit', icon: '😣', say: 'Saya rasa sakit.' },
      { label: 'Ubah posisi', icon: '🛏️', say: 'Tolong ubah posisi saya.' },
      { label: 'Tandas', icon: '🚽', say: 'Saya perlu ke tandas.' },
      { label: 'Panas / Sejuk', icon: '🌡️', goto: 'temperature' },
    ],
  },
  {
    id: 'temperature',
    tiles: [
      { label: 'Panas', icon: '🥵', say: 'Saya rasa panas.' },
      { label: 'Sejuk', icon: '🥶', say: 'Saya rasa sejuk.' },
    ],
  },
]);
