// Load recorded fixtures and replay them through the gesture engine.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngineState, stepEngine } from '../../src/gestures/gesture-engine.js';

export const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** @returns {{ file: string, fixture: object }[]} */
export function loadFixtures(dir = FIXTURE_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, fixture: JSON.parse(readFileSync(path.join(dir, file), 'utf8')) }));
}

/** Run every frame through the engine. @returns events [{type, t}] */
export function replay(fixture, config) {
  let state = createEngineState(config.settings.gestureMap);
  const events = [];
  for (const frame of fixture.frames) {
    const out = stepEngine(state, frame, config);
    state = out.state;
    events.push(...out.events);
  }
  return events;
}
