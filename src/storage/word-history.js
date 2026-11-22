// Word prediction for the speller: suggests words starting with what the user has
// typed, ranking words the USER has spoken before above the built-in list.
// The user's words are counted in localStorage only (never sent anywhere).
// predict() and learnWords() are pure; createWordPredictor() adds storage.
import { MALAY_WORDS } from './malay-words.js';

export const WORDS_KEY = 'woca.words';

const normalize = (w) => w.toUpperCase().replace(/[^A-Z]/g, '');

/**
 * @param prefix  letters typed for the current word (any case)
 * @param history { WORD: timesSpoken }
 * @returns up to `limit` words, most likely first (never the prefix itself)
 */
export function predict(prefix, history, { limit = 3, minPrefix = 1, words = MALAY_WORDS } = {}) {
  const p = normalize(prefix);
  if (p.length < minPrefix) return [];
  const rank = new Map(words.map((w, i) => [w, i]));
  const candidates = new Set([...Object.keys(history), ...words].filter((w) => w.startsWith(p) && w !== p));
  const score = (w) => (history[w] ?? 0) * 100000 - (rank.get(w) ?? words.length);
  return [...candidates].sort((a, b) => score(b) - score(a) || a.localeCompare(b)).slice(0, limit);
}

/** Count each word in a spoken message. Keeps the `max` most used words. */
export function learnWords(history, text, { max = 500 } = {}) {
  const out = { ...history };
  for (const w of text.split(/\s+/).map(normalize).filter((x) => x.length >= 2)) out[w] = (out[w] ?? 0) + 1;
  const entries = Object.entries(out);
  if (entries.length <= max) return out;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, max));
}

/** Predictor bound to localStorage. @param getOptions () => settings.speller */
export function createWordPredictor({ storage = globalThis.localStorage, getOptions }) {
  let history = {};
  try {
    const stored = JSON.parse(storage?.getItem(WORDS_KEY) ?? '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      history = Object.fromEntries(Object.entries(stored).filter(([w, n]) => /^[A-Z]+$/.test(w) && Number.isInteger(n) && n > 0));
    }
  } catch {
    /* start fresh */
  }

  return {
    suggest(prefix) {
      const o = getOptions();
      return predict(prefix, history, { limit: o.suggestions, minPrefix: o.minPrefix });
    },
    learn(text) {
      history = learnWords(history, text, { max: getOptions().historyMax });
      try {
        storage.setItem(WORDS_KEY, JSON.stringify(history));
      } catch {
        /* storage blocked: keep learning for this session only */
      }
    },
  };
}
