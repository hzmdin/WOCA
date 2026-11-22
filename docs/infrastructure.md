# infrastructure.md: The "How"

## 1. Tech stack (and why)
| Layer | Choice | Why |
|---|---|---|
| Runtime | **Browser (Chrome/Edge) on a Windows laptop** | Webcam, speech and UI in one place. No installer. |
| Language | Vanilla **JavaScript (ES modules)** | No framework to learn. Easy to debug. |
| Dev server / build | **Vite** | Instant reload. `npm run build` gives static files that run offline. |
| Face tracking | **MediaPipe Tasks Vision: Face Landmarker** (`@mediapipe/tasks-vision`) | Runs locally on CPU/GPU. Gives 478 landmarks, **52 blendshapes** (eyeBlink, eyeLookIn/Out/Up/Down, mouthSmile…) and a **head-pose matrix**. That's everything we need. |
| Speech | **Web Speech API** (`speechSynthesis`, `lang: "ms-MY"`) **+ recorded MP3 clips** | Built in. Uses the offline Windows Malay voice (install it from *Settings → Time & language → Language & region → add Bahasa Melayu → Speech*). Recorded voice clips (a familiar voice) can sound more natural. Note: Edge's "Natural" online Malay voices need internet, so they are **not** used. |
| Storage | **localStorage** (JSON) | Settings and phrases only. Small and simple. |
| Tests | **Vitest** | Same JS, fast, no browser needed for pure logic. |

> Why not Python + OpenCV (as Gemini suggested)? It works, but you'd need a separate UI and TTS bridge. In the browser, a single stack does camera, gestures, UI and speech.

## 2. Hardware
- A **USB webcam (720p+) on a gooseneck clamp mount** attached to the bed's side rail or an overbed table. Point it at the user's face from slightly below eye level, about 50–80cm away. Because it's attached to the bed, it moves with the user, which reduces how often you need to Re-centre.
- **Screen:** a laptop on an overbed table, or a monitor/tablet on an adjustable arm, angled to match how far the bed is reclined so the user can see it without lifting their head. Put the camera right next to the screen so "looking at the screen" means "looking at the camera".
- Speakers loud enough to be heard in another room (for Call for help).
- Even, front-facing light. Avoid a ceiling light directly over the user's face or a bright window behind them.

## 3. Data flow
```
Webcam ──► vision/face-tracker.js ──► FaceSignals (per frame, ~30fps)
                                          │
                                          ▼
                         gestures/gesture-engine.js  (pure, stateful)
                         - normalize vs. calibrated neutral
                         - threshold + hold-time + cooldown
                                          │  GestureEvent
                                          ▼
                         ui/board-controller.js ──► render board
                                          │  selected item
                                          ▼
                         speech/speaker.js ──► speakers
```

## 4. Key data contracts

### FaceSignals (output of `vision/`, one per frame)
```js
{
  t: 123456.7,            // ms timestamp
  faceFound: true,
  yaw: -12.3,             // head turn, degrees (+ = the user's left)
  pitch: 4.1,             // head nod, degrees (+ = up)
  roll: 0.5,
  blendshapes: {          // 0..1, subset we use
    eyeBlinkLeft, eyeBlinkRight,
    eyeLookOutLeft, eyeLookInLeft, eyeLookUpLeft, eyeLookDownLeft,
    eyeLookOutRight, eyeLookInRight, eyeLookUpRight, eyeLookDownRight,
    mouthSmileLeft, mouthSmileRight, jawOpen
  }
}
```

### Calibration (stored in localStorage `woca.calibration`, built by `src/gestures/calibration.js`)
```js
{
  version: 2,
  neutral: { yaw, pitch, roll },             // resting head pose (degrees)
  baseline: { eyesLeft, eyesRight, eyesUp, eyesDown, eyesClosed, smile },  // resting eye/face scores
  guard: { smile, jawOpen },                 // expression-guard thresholds above the resting mouth (null = settings)
  ranges: {                                  // full-effort distance from neutral (always positive)
    headLeft: 20, headRight: 20, headUp: 15, headDown: 15,   // degrees
    eyesLeft: 0.6, eyesRight: 0.6, eyesUp: 0.5, eyesDown: 0.5, eyesClosed: 0.75, smile: 0.6  // 0..1 scores
  },
  createdAt: "2026-12-01T10:00:00Z"
}
```
Defaults (used before calibration) are in `DEFAULT_CALIBRATION` in `src/storage/default-settings.js`.

### Settings (stored; defaults in `src/storage/default-settings.js`)
```js
{
  gestureMap: { LEFT: "eyesLeft", RIGHT: "eyesRight", UP: "eyesUp", DOWN: null, SELECT: "longBlink", PAUSE: "eyesClosed3s", HELP: null },
  // eye defaults need calibration (resting eye offset)
  thresholdPct: 0.6,      // fraction of calibrated range needed to START a hold
  releasePct: 0.3,        // below this = back to neutral (hysteresis + re-arm)
  holdMs: 600,
  cooldownMs: 800,
  longBlinkMs: 1000,      // longBlink fires on eye-open after 1s..pauseHoldMs closed
  pauseHoldMs: 3000,      // eyesClosed3s fires while closed; cancels longBlink
  scanMode: false, scanIntervalMs: 1500,
  voice: { name: null, rate: 0.9, lang: "ms-MY" },
  faceLost: { showAfterMs: 1000, hideAfterMs: 300 },
  breakReminder: { afterMin: 15, showMs: 10000 }
}
```

### Board / Phrase data (stored, editable)
```js
{
  boards: [
    { id: "home", tiles: [ { label: "Keperluan", goto: "needs" }, { label: "Ya/Tidak", goto: "yesno" }, ... ] },
    { id: "needs", tiles: [ { label: "Air", icon: "💧", say: "Saya nak minum air.", audio: "audio/air.mp3" }, ... ] }
    // `audio` is optional: if the file exists, play it; otherwise speak `say` with TTS
  ]
}
```

### GestureEvent
```js
{ type: "LEFT" | "RIGHT" | "UP" | "DOWN" | "SELECT" | "BACK" | "PAUSE", t: 123456.7 }
```

### Saved data (localStorage, all validated on load; broken data → defaults)
| Key | Module | Contents |
|---|---|---|
| `woca.settings` | `src/storage/settings-store.js` | Only the `EDITABLE` fields (merged over `DEFAULT_SETTINGS` on load) |
| `woca.boards` | `src/storage/boards-store.js` | The full boards array as edited in Tetapan → Frasa |
| `woca.calibration` | `src/storage/calibration-store.js` | Calibration v2 |

Backup file (`src/storage/backup.js`): `{ format: "woca-backup", version: 1, savedAt, settings (editable only), boards, calibration }`.

## 5. Gesture engine logic (the heart)
Implemented in `src/gestures/gesture-definitions.js` (what each gesture measures) and `src/gestures/gesture-engine.js` (`createEngineState`, pure `stepEngine(state, signals, {settings, calibration})`).

For each mapped gesture: `activation = (signal − neutral) / range` (0 = neutral, 1 = full effort).
- A hold **starts** at `activation ≥ thresholdPct` and **continues** while `≥ releasePct` (hysteresis, so wobble doesn't reset it).
- `hold` gestures: held for `holdMs` → emit, start global `cooldownMs`, and disarm until a **return to neutral** (`< releasePct`).
- `release` gestures (longBlink): emit on release if held between `longBlinkMs` and `pauseHoldMs`. So eyes closed 3s = PAUSE only, never SELECT as well.
- `faceFound === false` → reset all hold timers (no events).
- **Eye-direction gestures** (eyesLeft/Right/Up/Down) are ignored while any head activation ≥ `eyeGestureMaxHeadPct` (0.5): turning the head while watching the screen counter-rotates the eyes. Blink gestures are not affected.
- UP/DOWN = `rowSwitch` (same column, wraps). With ≤2 rows they are equivalent, so map only UP (prefer look up; look down overlaps with blinks).
- **Expression guard:** if avg mouthSmile ≥ `expressionGuard.smile` or jawOpen ≥ `expressionGuard.jawOpen`, reset holds and ignore input until `tailMs` after the mouth relaxes (output `guarded: true`). The smile part is skipped if `smile` is mapped as a gesture. It exists because a recorded laugh fired LEFT + SELECT without it.
- **Re-centre** (`src/gestures/recentre.js`, key `C`): re-measures only `neutral` and the eye-direction baselines over 2s (fails if the head moves > 6°). **Drift watch** suggests it after 10s off-centre with no gesture.
- **Regression fixtures:** `tests/fixtures/*.json` are replayed by `tests/fixtures.test.js` against expected events per label.
- `paused` → only the PAUSE gesture is checked. A PAUSE event toggles `state.paused`; the caregiver's `P` key calls `setPaused`. Every pause/resume **disarms all gestures** until a return to neutral.
- `progress[event]` for the UI ring = held / hold time.

## 6. Security and privacy
- No network calls at runtime. The MediaPipe `.task` model and WASM files are served from `/public`, not a CDN.
- Camera access is via `getUserMedia`, on localhost only.
- No frames are stored. Only numbers (signals) stay in memory. The session log holds time plus phrase text only.

## 7. Running and deployment
- Dev: `npm install` → `npm run dev` → open `http://localhost:5173`.
- **Daily use: double-click `start-woca.cmd`** (or the desktop "WOCA" shortcut made by `scripts/create-shortcut.ps1`). It:
  1. checks Node.js is installed and runs `npm install` the first time,
  2. reuses a server already on port 5173 or starts `vite` minimized ("WOCA server" window),
  3. waits up to ~30 s, then opens `msedge --app=http://localhost:5173 --start-fullscreen` with its **own profile** in `%LOCALAPPDATA%\WOCA\edge-profile`.
  It uses the dev server (no build step), so it always runs the current code. Close WOCA with Alt+F4; F11 leaves full screen.
- **Note:** the WOCA profile has its own localStorage, separate from the developer's normal Edge. Settings/calibration made at `localhost:5173` in normal Edge don't appear there. Move them with Tetapan → Sandaran (export, then import in the WOCA window), or set up directly in the WOCA window.
- First launch asks for camera permission once (it's remembered in the WOCA profile). The caregiver still clicks **Mula** each session (browser sound rule).
- Requirements for the local launcher: Windows, Edge, Node.js LTS, the WOCA folder (copy it including `public/models`; `npm install` restores `node_modules` and the MediaPipe WASM files).
- `.cmd` files must keep Windows (CRLF) line endings; `.gitattributes` enforces this.
- Backup: "Export settings" downloads a JSON file. "Import" restores it.

## 8. Existing tools to compare against (try these first!)
- **Google "Look to Speak"** (free Android app, eye-gaze phrases): a baseline for comparison.
- **Google Project Gameface** (open source, face-gesture mouse for Windows/Android).
- **eViacam** (head-tracking mouse) + **OptiKey** (on-screen keyboard).
If one of these already works well for the user, use it, and build only the pieces that are missing.
