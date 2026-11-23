# WOCA: Whenever Operating Communication Assistant

**WOCA** is a communication board for people who **cannot speak or move their body, but can still move their eyes and head**. It runs in a web browser with an ordinary webcam: the user looks left or right to move between big tiles, looks up to switch row, and holds a long blink to choose. The chosen phrase is **spoken aloud in Malay**.

**Use it:** <https://hzmdin.github.io/WOCA/> (Edge or Chrome on a laptop with a webcam)

> 🇲🇾 **Ringkasan:** WOCA ialah papan komunikasi untuk orang yang tidak boleh bercakap atau bergerak, tetapi masih boleh menggerakkan mata dan kepala. Jeling ke kiri/kanan untuk bergerak, pandang ke atas untuk tukar baris, dan kelip lama (1 saat) untuk memilih. Frasa disebut dalam Bahasa Melayu.

---

## Features

- **Eye and head gestures** via the webcam: look left/right, look up, long blink. Head turns can be used instead (settings).
- **Talking boards** in Malay: needs (water, pain, hot/cold, toilet, change position…), feelings, thanks. At most 6 big tiles per screen.
- **Yes / No mode:** two huge halves; a glance to one side answers.
- **Call for help:** a "Tolong!" tile (and an optional dedicated gesture) starts a loud, repeating alarm that **only the caregiver** can stop.
- **Colour-coded tiles** by category (colour-blind-safe, labels always stay; can be turned off in settings).
- **Auto-scan mode** (optional): the highlight moves by itself and a long blink selects, so only one gesture is needed on tired days. Turn it on in settings.
- **Speller** (E-Tran style letter groups) with **Malay word prediction** that learns the user's own words.
- **Calibration** to the user's own range of movement, and **re-centre** after the bed angle changes.
- **Safety by design:** a hold time, return-to-neutral and cooldown for every gesture; input is ignored while laughing or talking, while the head is turned, or when the face is lost; a long blink needs the eyes almost fully closed (so looking down doesn't select).
- **Pause** (eyes closed 3 s or key `P`), **face-lost** banner and a gentle **break reminder**.
- **Caregiver settings** in Malay: movements, sensitivity, voice, phrases, backup and restore.
- **Works offline** once installed.

## Privacy

- The camera image is processed **only on the device** (MediaPipe Face Landmarker running in the browser). No video, images or audio are stored or sent anywhere.
- Settings, calibration, phrases and learned words are kept in the browser's local storage on that device.
- The website only delivers the program files; it has no server-side code, accounts or tracking.

## Getting started (caregivers)

1. Open <https://hzmdin.github.io/WOCA/> in **Microsoft Edge** (or Chrome).
2. **Install it as an app:** in Edge, click the *App available / Install* icon in the address bar (or ⋯ → Apps → Install this site as an app). WOCA gets its own icon and works without internet afterwards.
3. **Malay voice (Windows):** Settings → Time & language → Speech → *Manage voices → Add voices* → **Malay**. Restart Edge afterwards. The voice status under the buttons should say "(luar talian)".
4. Allow the **camera** when asked, then click **Mula** (needed once per session so the browser allows sound).
5. Press **K** to **calibrate** with the user. Eye gestures need calibration before use.

### Caregiver keys

| Key | Action |
|---|---|
| `P` | Pause / resume |
| `K` | Calibrate |
| `C` | Re-centre (after the bed angle changes) |
| `S` | Settings (Tetapan) |
| `T` | Test the voice |
| `D` | Show/hide the developer panel |
| ← → ↑ ↓, Enter, Backspace | Move, select, back (caregiver override) |
| Space / Enter / Esc | Stop the help alarm |

Mouse clicks on tiles also work.

## Development

Requirements: Node.js 20+ (LTS recommended).

```bash
npm install        # also copies the MediaPipe WASM files and downloads the face model if missing
npm run dev        # http://localhost:5173
npm test           # unit tests + regression tests on recorded face signals
npm run build      # production build in dist/ (served under /WOCA/)
npm run preview    # serve the build at http://localhost:4173/WOCA/
```

On Windows, `start-woca.cmd` starts the dev server and opens WOCA full-screen in Edge; `scripts/create-shortcut.ps1` puts a WOCA shortcut on the Desktop.

### Project structure

```
src/vision      camera + MediaPipe → face signals (head angles, eye/mouth scores)
src/gestures    face signals → events (LEFT, RIGHT, UP, SELECT, PAUSE, HELP), calibration, re-centre
src/ui          boards, speller, settings, calibration wizard, overlays (Malay strings in strings-ms.js)
src/speech      Malay text-to-speech, chime and help alarm
src/storage     default settings and boards, word list, saved data, backup
public          face model, icons, web-app manifest, offline service worker
tests           Vitest tests; tests/fixtures holds recorded face signals (numbers only, no images)
docs            spec.md (what) and infrastructure.md (how)
```

Gesture logic is written as pure functions so it can be tested frame by frame without a camera. Recorded face signals (laughing, talking, blinking, looking around) are replayed in the tests to prove that, for example, **laughing never triggers a selection**.

### Publishing

Every push to `main` runs the tests, builds, and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

## Third-party

- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) and the Face Landmarker model © Google, Apache License 2.0.
- [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/), MIT License.

## License

[MIT](LICENSE) © hzmdin
