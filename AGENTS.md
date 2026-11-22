# AGENTS.md: Project Constitution

> Read this file first. Product details live in `docs/spec.md` and tech details in `docs/infrastructure.md`. Don't copy facts between files. Link to them.
> A local development log may exist in `docs/private/` (not published).

## Project in one line
**WOCA (Whenever Operating Communication Assistant)** is a webcam app that runs in the browser. It lets a person who can move only their eyes, head and face choose phrases and spell words with eye and head gestures, and the computer speaks them out loud in Malay.

## Who this is for (never forget)
- **User:** a person who can't speak or move their body, but can move their eyes and head, smile and laugh. They tire easily.
- **Operator:** a caregiver who sets things up, calibrates and edits phrases.

## Core principles (in priority order)
1. **Don't make things worse for the user.** An accidental "select" is worse than a slow one. When unsure, ignore the input.
2. **Low effort for the user.** Fewer gestures, bigger targets, short sessions. Never require precise movement.
3. **Private and offline.** No accounts, no cloud processing. The camera feed never leaves the device. After installation the app works without internet.
4. **The caregiver can always override.** Keyboard and mouse controls must keep working. Pause is always one key away.
5. **Simple code over clever code.** Every file should be easy to read and fix.

## Folder structure
```
/                     AGENTS.md, README.md, package.json, index.html, vite.config.js
/docs                 spec.md, infrastructure.md (private/ is local only, git-ignored)
/src
  /vision             camera + MediaPipe → raw face signals (no UI here)
  /gestures           raw signals → discrete events (LEFT, RIGHT, SELECT…)
  /ui                 screens/boards, render only, react to events
  /speech             text-to-speech, chime and alarm
  /storage            settings, phrases, calibration, word list (localStorage)
  main.js             wires modules together
  pwa.js              offline service-worker registration (production only)
/public               face model, icons, manifest, service worker (sw.js)
/tests                Vitest unit tests + recorded face-signal fixtures
/scripts              setup and Windows launcher helpers
```

## Coding style
- Plain **JavaScript (ES modules)**, no framework. Vite is the dev server and bundler only.
- Files: `kebab-case.js`. Functions and variables: `camelCase`. Constants: `UPPER_SNAKE_CASE`. Gesture event names are uppercase strings: `'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'SELECT' | 'BACK' | 'PAUSE' | 'HELP'`.
- One responsibility per module. Keep files under about 200 lines; split them if they get longer.
- **Gesture logic must be pure functions** (input: a frame of signals plus state, output: events plus new state) so it can be tested without a camera.
- Every tunable number (thresholds, hold times, cooldowns) goes in `src/storage/default-settings.js`. No magic numbers in the logic.
- Comments explain *why*, not *what*.

## Language
- **Everything the user sees or hears is in Malay** (`ms-MY`): tile labels, spoken phrases, prompts like "Dijeda" (Paused) and "Wajah tidak kelihatan" (Face not visible).
- Code, comments and docs stay in English.
- Keep all user-facing strings in `src/ui/strings-ms.js`. Never hard-code them in components.

## UI rules
- Minimum target size: **1/6 of the screen** (max 6 tiles per board). Font of at least 48px on boards.
- High contrast (dark background, light text), with a highlight that's easy to see. No red/green-only signals.
- Every selection gives **visual feedback (a progress ring) while held**, then a sound and a spoken result.
- No animations faster than 300ms. No flashing.

## Testing rules
- Test every gesture-detector and board-navigation function in `/tests` with Vitest.
- Use recorded face-signal fixtures (JSON, numbers only) for regression tests, e.g. "a laugh must NOT trigger SELECT".
- Before marking a change done: run `npm test`, then test manually with a real face.

## Do
- Ask before adding any dependency.
- Keep a **Pause** state that stops all gesture input (key `P`, plus a dedicated gesture).
- Make thresholds adjustable from the settings screen, not just in code.

## Do not
- ❌ Send camera frames, audio or phrases to any server or API.
- ❌ Store video or images. Use landmark numbers only, in memory.
- ❌ Add brain-computer-interface, medical-diagnosis or "emotion detection" features.
- ❌ Use **smile/laugh as the default SELECT**. People laugh naturally, so it would cause false triggers. It can be an opt-in setting.
- ❌ Make a change that silences or breaks the "Call for help" alert.
- ❌ Rewrite working modules without being asked. Make small, surgical changes.
