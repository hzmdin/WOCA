// "Call for help" loop: alarm tones, then the spoken call, repeated every
// repeatMs until the CAREGIVER dismisses it. There is deliberately no way for
// a gesture to stop it (AGENTS.md: never silence or break Call for help).
// Sound and timers are injected so the loop can be tested with fake timers.
import { ALARM_MS } from './chime.js';

/**
 * @param deps {
 *   alarm(),          // play the alarm tones once
 *   speak(),          // speak the call for help once
 *   stopSpeech(),     // stop any speech (on dismiss)
 *   getRepeatMs(),
 *   timers?: { setTimeout, clearTimeout, setInterval, clearInterval }
 * }
 */
export function createHelpAlarm({ alarm, speak, stopSpeech, getRepeatMs, timers = globalThis }) {
  let active = false;
  let interval = null;
  let speakTimer = null;

  function cycle() {
    alarm();
    // Speak after the tones so the words are not drowned out.
    speakTimer = timers.setTimeout(() => {
      if (active) speak();
    }, ALARM_MS);
  }

  return {
    isActive: () => active,

    /** Start the alarm. Starting again while active does nothing (no double alarm). */
    start() {
      if (active) return;
      active = true;
      cycle();
      interval = timers.setInterval(cycle, getRepeatMs());
    },

    /** Caregiver only: stop the alarm. */
    dismiss() {
      if (!active) return;
      active = false;
      timers.clearInterval(interval);
      timers.clearTimeout(speakTimer);
      stopSpeech();
    },
  };
}
