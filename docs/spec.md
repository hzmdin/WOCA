# spec.md: The "What"

## 1. Problem statement
Some people can't speak or move their body, but can still move their **eyes and head**, smile and laugh (for example after a stroke, with ALS/MND, or with other neurological conditions). Without a tool, the people around them have to guess their needs or ask slow yes/no questions, and they have no way to start a conversation, say something specific, or call for help when nobody is looking.

**Goal:** a reliable, low-effort way to (1) answer yes/no, (2) say common needs, (3) call for attention and (4) spell anything, using only a laptop and a normal webcam. UI and speech are in **Malay**.

## 2. Users
| User | Abilities and constraints | Main needs |
|---|---|---|
| User (primary) | Eye movement, head turns/nods, smile/laugh. Tires quickly. May be lying down or reclined. | Be understood, call for help, express feelings, chat |
| Caregiver (operator) | Full ability, not technical | Quick setup, calibrate, edit phrases, pause |

## 3. Input model: "gestures to events"
The app turns face signals into a **small set of discrete events**. Each event must be **held** for a configurable time (default 600 ms), with a cooldown after it fires (default 800 ms).

| Event | Default gesture | Notes |
|---|---|---|
| `LEFT` / `RIGHT` | Look left / right (eyes only) | Main navigation. Head turns are also available in settings |
| `UP` | Look up (eyes) = "Tukar baris" (switch row) | With ≤2 rows one row-switch is enough. `DOWN` is off: looking down overlaps with blinking |
| `SELECT` | Long blink (eyes almost fully closed > 1 s) | Other gestures can be chosen in settings |
| `BACK` | Configurable | Optional |
| `PAUSE` toggle | Eyes closed about 3 s, or caregiver key `P` | Lets the user rest without misfires |
| `HELP` | Off by default (optional, 2 s hold) | Works on every screen, even while paused. Recommended with auto-scan, where "Tolong!" can take several steps to reach |

The caregiver picks which gestures are on, based on what the user does reliably and comfortably. Available gestures: head turns and nods, eyes left/right/up/down, long blink, eyes closed 3 s, **eyebrow raise**, smile and **mouth open**. Smile and mouth open are **opt-in only**: laughing and talking trigger them, so they are never a default and are not tested unless ticked in the gesture test. Eyebrow raise is a good candidate when the eyes are unreliable (the expression guard still ignores laughing while it is used). When mouth open is mapped, the guard no longer ignores an open mouth (it would block itself), but still ignores a smile.

## 4. Core features
1. **Calibration wizard:** the user does each gesture 3 times while the app records their range and sets thresholds. Eye gestures require calibration.
2. **Yes / No mode:** two huge halves of the screen. A turn toward a half answers straight away (held for the normal hold time); the user stays on the screen for the next question, and a long blink goes back to Home. Which side is "Ya" is configurable.
3. **Quick Needs boards:** at most 6 big tiles per board (each ≥ 1/6 of the screen). Selecting one speaks a full Malay sentence (e.g. Air → "Saya nak minum air."). Non-home boards get a "Kembali" (back) tile. Data: `src/storage/default-boards.js`.
4. **Call for help:** a "Tolong!" tile (last on Home: one LEFT + SELECT) and an optional `HELP` gesture. A loud, repeating alarm plus a spoken call; **only the caregiver** can stop it (Space/Enter/Esc or the button). No flashing.
5. **Speech:** every selection is spoken in Malay using an offline system voice, or a recorded clip per phrase.
6. **Re-centre:** after a bed-angle change, the caregiver presses `C` while the user looks at the screen; only the resting pose is updated (2 s). A drift watch suggests it.
7. **Caregiver settings:** movements, sensitivity, hold times, voice, phrases, backup/restore. Saved locally.
8. **Speller (E-Tran style):** letter groups → letter; actions Sebut (speak), Ruang (space), Padam (delete), X, Keluar.
9. **Word prediction:** up to 3 suggestions from a built-in Malay word list plus the user's own spoken words (stored locally only).
10. **Colour categories:** tiles are tinted by kind (menus sky blue, feelings purple, needs green, speller blue, help red, back grey; each speller letter group has its own colour, like coloured pens on an E-Tran board). Colour is only an extra clue next to the label and icon, uses a colour-blind-safe palette, never replaces the yellow highlight, and can be turned off in settings.
11. **Auto-scan mode (opt-in):** the highlight moves through the tiles by itself (default 2.5 s per tile, extra time on each new screen) and the user only needs one gesture, a long blink, to select. Movement gestures are switched off while it is on. The highlight never moves while a blink is being held, while paused, while the face is lost, or while a phrase is spoken. Yes/No becomes Ya / Tidak / Kembali. Caregiver keys still work. Off by default; turn it on in settings. **Audio scan** (also opt-in): each highlighted tile is spoken aloud as the highlight lands on it (letter groups are spelled out), so the user can choose by ear when vision is blurry or the screen is hard to see.
12. **Simple mode (opt-in, "3 tiles"):** at most 3 huge tiles on screen at once; the highlight flows on to the next page by itself (pages are balanced, so 4 tiles show as 2+2) and small dots show the page. Scan order and timing are unchanged. For blurry vision or bad days. Off by default; turn it on in settings.
13. **Gesture test (caregiver, key `G`):** finds which gesture the user does most reliably. The caregiver ticks the gestures to try; the user tries each 3 times (short, because they tire easily) with rest in between. The real gesture engine decides what counts as detected, and any detection during rest counts as an accidental trigger. The result lists every gesture (detected tries, average time, accidental triggers, rating good / ok / poor) and recommends the best one for "Pilih". Smile is not tested unless ticked. The clock waits while the face is not visible. Nothing is saved or changed automatically: the caregiver sets the gesture in settings.
14. **Status banners:** "Wajah tidak kelihatan" (face lost) and a gentle break reminder after 15 minutes of use.

## 5. Possible future features
- Phrase history and favourites.
- "How I feel" board with a 0–10 pain scale.
- Session log (time + phrase only, never video).

## 6. User flows
**A. Daily start (caregiver):** open the app, check the camera sees the face, press **Mula** (unlocks sound). The last calibration loads.
**B. Asking for water:** Home → move to "Keperluan" → SELECT → "Air" → SELECT. A progress ring fills, a chime plays, the sentence is spoken, and the app returns to Home after 3 s.
**C. Urgent help:** "Tolong!" (or the HELP gesture) → repeating alarm until the caregiver stops it.
**D. Tired:** eyes closed about 3 s pauses the app (screen dims, "Dijeda"). The same gesture or `P` resumes.

## 7. Edge cases
- **Face lost:** freeze input and show "Wajah tidak kelihatan". Never fire events from partial data.
- **Laughing or talking:** an expression guard ignores input while the mouth is active (recorded laugh/talk fixtures prove 0 events).
- **Head turn while watching the screen:** the eyes counter-rotate (a reflex); eye gestures are ignored while the head is turned.
- **Looking down vs blinking:** looking down half-closes the eyelids; a long blink requires the eyes almost fully closed.
- **Involuntary movement:** hold time, cooldown and return-to-neutral filter it out.
- **Reclined bed:** gestures are measured from the stored resting pose; use Re-centre when the bed moves.
- **Fatigue:** break reminder after 15 minutes of active use.
- **Several faces:** only one face is tracked.
- **No offline voice:** text is still shown in large letters; settings show install hints.

## 8. Out of scope
- Brain/EEG reading, medical diagnosis, emotion recognition.
- Cloud services, accounts, remote access. (The app files may be served from a static host; all processing and data stay on the device.)
- Dedicated eye-tracker hardware.

## 9. Acceptance criteria
- [ ] After calibration, the user answers **10 yes/no questions with at least 9 correct**.
- [ ] A specific Quick Needs item can be chosen in **under 15 seconds**.
- [ ] **Zero false SELECTs** during a 5-minute conversation that includes laughing.
- [ ] Call for help works from any screen and keeps sounding until dismissed.
- [ ] The app works with the internet turned off (after installation).
- [ ] The caregiver can change a phrase without touching code.
- [ ] A 10-minute session is **not tiring** for the user.
