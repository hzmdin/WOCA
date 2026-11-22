// Sounds generated with Web Audio (no sound files, works offline):
//  - play():  a short, soft two-note chime when a tile is selected
//  - alarm(): a loud, attention-getting pattern for "Call for help"

const NOTES = [
  { freq: 660, start: 0, dur: 0.12 },
  { freq: 880, start: 0.12, dur: 0.18 },
];
const VOLUME = 0.15;

// Three rising pairs over ~1.2s: urgent but not a harsh siren.
const ALARM_NOTES = [0, 0.4, 0.8].flatMap((t) => [
  { freq: 880, start: t, dur: 0.15 },
  { freq: 1175, start: t + 0.17, dur: 0.18 },
]);
export const ALARM_MS = 1200;

export function createChime(AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let ctx = null;

  const context = () => {
    if (!ctx && AudioCtx) ctx = new AudioCtx();
    return ctx;
  };

  return {
    /** Call from a click/keypress: browsers only allow audio after one. */
    unlock() {
      context()?.resume?.();
    },

    play() {
      playNotes(context(), NOTES, VOLUME, 'sine');
    },

    /** @param volume 0..1 (settings.help.volume) */
    alarm(volume) {
      playNotes(context(), ALARM_NOTES, volume, 'triangle');
    },
  };
}

function playNotes(c, notes, volume, type) {
  if (!c) return;
  const t0 = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = n.freq;
    // Fade in/out to avoid clicks.
    gain.gain.setValueAtTime(0, t0 + n.start);
    gain.gain.linearRampToValueAtTime(volume, t0 + n.start + 0.02);
    gain.gain.linearRampToValueAtTime(0, t0 + n.start + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.02);
  }
}
