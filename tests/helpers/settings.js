// Test setups that don't depend on what the current defaults are.
import { DEFAULT_SETTINGS } from '../../src/storage/default-settings.js';

/** Head turns move, long blink selects: the original setup many engine tests use. */
export const HEAD_SETTINGS = Object.freeze({
  ...DEFAULT_SETTINGS,
  gestureMap: Object.freeze({
    ...DEFAULT_SETTINGS.gestureMap,
    LEFT: 'headLeft',
    RIGHT: 'headRight',
    UP: null,
    DOWN: null,
  }),
});
