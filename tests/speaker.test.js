import { describe, it, expect, vi } from 'vitest';
import { pickVoice, createSpeaker } from '../src/speech/speaker.js';

// Voices as Windows + Edge typically report them.
const RIZWAN = { name: 'Microsoft Rizwan - Malay (Malaysia)', lang: 'ms-MY', localService: true };
const YASMIN_ONLINE = { name: 'Microsoft Yasmin Online (Natural) - Malay (Malaysia)', lang: 'ms-MY', localService: false };
const DAVID = { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true };
const MS_GENERIC = { name: 'Some Malay', lang: 'ms', localService: true };

describe('pickVoice', () => {
  it('prefers an offline Malay (Malaysia) voice over an online one', () => {
    expect(pickVoice([DAVID, YASMIN_ONLINE, RIZWAN])).toBe(RIZWAN);
  });

  it('uses the exact voice name from settings when present', () => {
    expect(pickVoice([RIZWAN, YASMIN_ONLINE], { name: YASMIN_ONLINE.name, lang: 'ms-MY' })).toBe(YASMIN_ONLINE);
  });

  it('falls back to any offline Malay voice ("ms")', () => {
    expect(pickVoice([DAVID, MS_GENERIC])).toBe(MS_GENERIC);
  });

  it('uses an online Malay voice only if no offline one exists', () => {
    expect(pickVoice([DAVID, YASMIN_ONLINE])).toBe(YASMIN_ONLINE);
  });

  it('returns null when there is no Malay voice (never picks English)', () => {
    expect(pickVoice([DAVID])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });

  it('handles underscore language codes (ms_MY)', () => {
    const v = { name: 'x', lang: 'ms_MY', localService: true };
    expect(pickVoice([DAVID, v])).toBe(v);
  });
});

// --- fakes -------------------------------------------------------------
function fakeSynth(voices = [RIZWAN]) {
  const spoken = [];
  const handlers = {};
  return {
    spoken,
    getVoices: () => voices,
    speak(u) {
      spoken.push(u);
      queueMicrotask(() => u.onend?.());
    },
    cancel: vi.fn(),
    addEventListener: (type, fn) => (handlers[type] = fn),
    fire: (type) => handlers[type]?.(),
  };
}
class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}
/** Audio factory. ok=true: plays to the end. ok=false: fires error (missing file). */
function fakeAudio(ok) {
  const created = [];
  const factory = (src) => {
    const listeners = {};
    const audio = {
      src,
      pause: vi.fn(),
      addEventListener: (t, fn) => (listeners[t] = fn),
      play() {
        queueMicrotask(() => (ok ? listeners.ended?.() : listeners.error?.()));
        return Promise.resolve();
      },
    };
    created.push(audio);
    return audio;
  };
  factory.created = created;
  return factory;
}
const voiceSettings = () => ({ name: null, rate: 0.9, lang: 'ms-MY' });

describe('createSpeaker', () => {
  it('speaks with the Malay voice, language and rate', async () => {
    const synth = fakeSynth([DAVID, RIZWAN]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: fakeAudio(true), getVoiceSettings: voiceSettings });
    expect(await speaker.speak('Saya nak minum air.')).toBe('tts');
    const u = synth.spoken[0];
    expect(u.text).toBe('Saya nak minum air.');
    expect(u.voice).toBe(RIZWAN);
    expect(u.lang).toBe('ms-MY');
    expect(u.rate).toBe(0.9);
  });

  it('plays the recorded clip instead of TTS when it exists', async () => {
    const synth = fakeSynth();
    const audio = fakeAudio(true);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: audio, getVoiceSettings: voiceSettings });
    expect(await speaker.speak('Saya nak minum air.', { audio: 'audio/air.mp3' })).toBe('clip');
    expect(audio.created[0].src).toBe('audio/air.mp3');
    expect(synth.spoken).toHaveLength(0);
  });

  it('falls back to TTS when the clip is missing', async () => {
    const synth = fakeSynth();
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: fakeAudio(false), getVoiceSettings: voiceSettings });
    expect(await speaker.speak('Saya nak minum air.', { audio: 'audio/missing.mp3' })).toBe('tts');
    expect(synth.spoken[0].text).toBe('Saya nak minum air.');
  });

  it('falls back to TTS when play() is blocked (e.g. autoplay policy)', async () => {
    const synth = fakeSynth();
    const blocked = () => ({ pause() {}, addEventListener() {}, play: () => Promise.reject(new Error('NotAllowedError')) });
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: blocked, getVoiceSettings: voiceSettings });
    expect(await speaker.speak('Ya', { audio: 'audio/ya.mp3' })).toBe('tts');
  });

  it('still speaks with the default voice (lang ms-MY) if no Malay voice is installed', async () => {
    const synth = fakeSynth([DAVID]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: fakeAudio(true), getVoiceSettings: voiceSettings });
    await speaker.speak('Ya');
    expect(synth.spoken[0].voice).toBeUndefined();
    expect(synth.spoken[0].lang).toBe('ms-MY');
    expect(speaker.currentVoice()).toBeNull();
  });

  it('reports none when the browser has no speech at all', async () => {
    const speaker = createSpeaker({ synth: null, Utterance: undefined, createAudio: fakeAudio(false), getVoiceSettings: voiceSettings });
    expect(speaker.available()).toBe(false);
    expect(await speaker.speak('Ya')).toBe('none');
  });

  it('stops whatever is speaking before a new phrase', async () => {
    const synth = fakeSynth();
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: fakeAudio(true), getVoiceSettings: voiceSettings });
    await speaker.speak('Satu');
    await speaker.speak('Dua');
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });

  it('tells listeners when voices finish loading', () => {
    const synth = fakeSynth([RIZWAN]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, createAudio: fakeAudio(true), getVoiceSettings: voiceSettings });
    const fn = vi.fn();
    speaker.onVoicesChanged(fn);
    synth.fire('voiceschanged');
    expect(fn).toHaveBeenCalledWith(RIZWAN);
  });
});
