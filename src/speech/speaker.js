// Speaks phrases out loud: a recorded voice clip if the phrase has one,
// otherwise the browser's text-to-speech in Malay (ms-MY).
// Prefers an OFFLINE (local) voice; Edge's "Online (Natural)" voices need internet.
// Browser APIs are injected so this can be tested without a browser.

/**
 * Choose the best voice. Order: exact name from settings, then offline ms-MY,
 * then any offline Malay ("ms-*"), then online Malay. null = none found.
 */
export function pickVoice(voices, { name = null, lang = 'ms-MY' } = {}) {
  if (!voices?.length) return null;
  if (name) {
    const exact = voices.find((v) => v.name === name);
    if (exact) return exact;
  }
  const base = lang.split('-')[0].toLowerCase();
  const sameLang = (v) => v.lang?.toLowerCase().replace('_', '-') === lang.toLowerCase();
  const sameBase = (v) => v.lang?.toLowerCase().startsWith(base);
  return (
    voices.find((v) => sameLang(v) && v.localService) ??
    voices.find((v) => sameBase(v) && v.localService) ??
    voices.find(sameLang) ??
    voices.find(sameBase) ??
    null
  );
}

/**
 * @param deps {
 *   synth:       speechSynthesis-like ({ getVoices, speak, cancel, addEventListener }) or null
 *   Utterance:   SpeechSynthesisUtterance-like constructor
 *   createAudio: (src) => HTMLAudioElement-like ({ play(): Promise, pause(), addEventListener })
 *   getVoiceSettings: () => ({ name, rate, lang })
 * }
 */
export function createSpeaker({
  synth = globalThis.speechSynthesis ?? null,
  Utterance = globalThis.SpeechSynthesisUtterance,
  createAudio = (src) => new Audio(src),
  getVoiceSettings,
}) {
  let currentAudio = null;
  const listeners = new Set();

  const voice = () => pickVoice(synth?.getVoices?.() ?? [], getVoiceSettings());

  // Voices load asynchronously in Chrome/Edge; tell the UI when they arrive.
  synth?.addEventListener?.('voiceschanged', () => listeners.forEach((fn) => fn(voice())));

  function stop() {
    synth?.cancel?.();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }

  /** @returns Promise<'tts'|'none'> resolves when finished */
  function speakTts(text) {
    if (!synth || !Utterance) return Promise.resolve('none');
    const settings = getVoiceSettings();
    return new Promise((resolve) => {
      const u = new Utterance(text);
      const v = voice();
      if (v) u.voice = v;
      u.lang = v?.lang ?? settings.lang;
      u.rate = settings.rate;
      // Chrome sometimes never fires onend; don't let callers wait forever.
      const timer = setTimeout(() => resolve('tts'), Math.max(5000, text.length * 250));
      u.onend = () => { clearTimeout(timer); resolve('tts'); };
      u.onerror = () => { clearTimeout(timer); resolve('none'); };
      synth.speak(u);
    });
  }

  /** @returns Promise<boolean> true if the clip played to the end */
  function playClip(src) {
    return new Promise((resolve) => {
      const audio = createAudio(src);
      currentAudio = audio;
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        if (currentAudio === audio) currentAudio = null;
        resolve(ok);
      };
      audio.addEventListener('ended', () => done(true));
      audio.addEventListener('error', () => done(false)); // e.g. file missing
      Promise.resolve(audio.play()).catch(() => done(false));
    });
  }

  return {
    /**
     * Speak a phrase. Stops anything already speaking first.
     * @param text   always required (TTS fallback, and shown on screen)
     * @param opts   { audio: 'audio/air.mp3' } optional recorded clip
     * @returns Promise<'clip'|'tts'|'none'> what was actually used
     */
    async speak(text, { audio } = {}) {
      stop();
      if (audio && (await playClip(audio))) return 'clip';
      return speakTts(text);
    },

    stop,

    /** The voice that will be used (null = browser default). */
    currentVoice: voice,

    /** All voices the system offers (for the settings screen). */
    voices: () => synth?.getVoices?.() ?? [],

    /** Called with the chosen voice whenever the voice list changes. */
    onVoicesChanged(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    available: () => Boolean(synth && Utterance),
  };
}
