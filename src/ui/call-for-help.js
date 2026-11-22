// "Call for help": joins the repeating alarm loop and the full-screen overlay.
// Started by the "Tolong!" tile or the HELP gesture; stopped only by the caregiver.
import { STRINGS } from './strings-ms.js';
import { createHelpAlarm } from '../speech/help-alarm.js';
import { createHelpOverlay } from './help-overlay.js';

/** @param opts { config, chime, speaker, onDismissed() } */
export function createCallForHelp({ config, chime, speaker, onDismissed }) {
  const alarm = createHelpAlarm({
    alarm: () => chime.alarm(config.settings.help.volume),
    speak: () => speaker.speak(STRINGS.help.spoken),
    stopSpeech: () => speaker.stop(),
    getRepeatMs: () => config.settings.help.repeatMs,
  });

  const overlay = createHelpOverlay(document.body, {
    onDismiss() {
      alarm.dismiss();
      overlay.hide();
      console.log('[woca] help dismissed');
      onDismissed();
    },
  });

  return {
    isActive: () => alarm.isActive(),
    start() {
      if (alarm.isActive()) return;
      console.log('[woca] HELP');
      overlay.show();
      alarm.start();
    },
  };
}
