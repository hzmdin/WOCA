import { describe, it, expect } from 'vitest';
import { predict, learnWords, createWordPredictor, WORDS_KEY } from '../src/storage/word-history.js';
import { MALAY_WORDS } from '../src/storage/malay-words.js';
import { LETTER_GROUPS } from '../src/ui/speller-controller.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}
const options = { suggestions: 3, minPrefix: 1, historyMax: 500 };

describe('word list', () => {
  it('has only upper-case A–Z words, no duplicates', () => {
    expect(MALAY_WORDS.every((w) => /^[A-Z]+$/.test(w))).toBe(true);
    expect(new Set(MALAY_WORDS).size).toBe(MALAY_WORDS.length);
  });

  it('every word can be typed with the speller (all letters exist)', () => {
    const letters = new Set([...LETTER_GROUPS.flat(), 'X']);
    expect(MALAY_WORDS.every((w) => [...w].every((ch) => letters.has(ch)))).toBe(true);
  });
});

describe('predict', () => {
  it('suggests list words starting with the prefix, most useful first', () => {
    expect(predict('SA', {})).toEqual(['SAYA', 'SAKIT', 'SAYANG']);
  });

  it('is case-insensitive and ignores non-letters', () => {
    expect(predict('sa', {})).toEqual(predict('SA', {}));
  });

  it('their own words rank above the built-in list', () => {
    expect(predict('SA', { SANGAT: 4 })[0]).toBe('SANGAT');
  });

  it('suggests words the user used that are not in the list (e.g. a name)', () => {
    expect(predict('AM', { AMINAH: 2 })).toContain('AMINAH');
  });

  it('nothing before the minimum prefix; never the prefix itself', () => {
    expect(predict('', {})).toEqual([]);
    expect(predict('YA', {})).not.toContain('YA');
  });

  it('respects the limit', () => {
    expect(predict('S', {}, { limit: 2 })).toHaveLength(2);
  });
});

describe('learnWords', () => {
  it('counts words of a spoken message (2+ letters)', () => {
    expect(learnWords({ SAYA: 1 }, 'saya sakit a')).toEqual({ SAYA: 2, SAKIT: 1 });
  });

  it('keeps only the most used words when over the limit', () => {
    const h = learnWords({ A1: 0, BB: 5, CC: 1 }, 'DD DD DD', { max: 2 });
    expect(Object.keys(h).sort()).toEqual(['BB', 'DD']);
  });
});

describe('createWordPredictor', () => {
  it('learns across sessions via storage', () => {
    const storage = memoryStorage();
    createWordPredictor({ storage, getOptions: () => options }).learn('sangat sangat');
    const next = createWordPredictor({ storage, getOptions: () => options });
    expect(next.suggest('SA')[0]).toBe('SANGAT');
  });

  it('ignores corrupted stored data', () => {
    const storage = memoryStorage({ [WORDS_KEY]: '{"sa<b>":3,"OK":"x","GOOD":2}' });
    const p = createWordPredictor({ storage, getOptions: () => options });
    expect(p.suggest('GO')[0]).toBe('GOOD'); // the valid learned word, ranked first
    expect(p.suggest('SA')).not.toContain('SA<B>');
    expect(createWordPredictor({ storage: memoryStorage({ [WORDS_KEY]: 'oops' }), getOptions: () => options }).suggest('SA')).toHaveLength(3);
  });
});
