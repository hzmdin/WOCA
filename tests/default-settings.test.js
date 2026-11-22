import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, AVAILABLE_GESTURES } from '../src/storage/default-settings.js';

describe('default settings', () => {
  it('never uses smile as the default SELECT (the user laughs naturally)', () => {
    expect(DEFAULT_SETTINGS.gestureMap.SELECT).not.toBe('smile');
  });

  it('only maps events to gestures the engine knows', () => {
    for (const gesture of Object.values(DEFAULT_SETTINGS.gestureMap)) {
      if (gesture !== null) expect(AVAILABLE_GESTURES).toContain(gesture);
    }
  });

  it('always has a PAUSE gesture so the user can rest', () => {
    expect(DEFAULT_SETTINGS.gestureMap.PAUSE).toBeTruthy();
  });

  it('speaks Malay by default', () => {
    expect(DEFAULT_SETTINGS.voice.lang).toBe('ms-MY');
  });
});
