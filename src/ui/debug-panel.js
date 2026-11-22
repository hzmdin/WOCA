// Live view of FaceSignals, gesture activations and fired events. For the
// developer/caregiver while testing which gestures work. Toggle with the D key.
// Labels are technical (English) on purpose: the user never sees this panel.
import { USED_BLENDSHAPES } from '../vision/face-signals.js';
import { GESTURES } from '../gestures/gesture-definitions.js';

const ANGLE_RANGE = 45; // degrees shown at the bar's end
const EVENT_LOG_SIZE = 6;

const ANGLE_ROWS = [
  { key: 'yaw', label: 'yaw (+ their left)' },
  { key: 'pitch', label: 'pitch (+ up)' },
  { key: 'roll', label: 'roll' },
];

/** Bar geometry for a value. Pure, so it can be tested. */
export function barStyle(value, kind) {
  if (kind === 'angle') {
    // Centred bar: grows left for negative, right for positive.
    const pct = Math.min(1, Math.abs(value) / ANGLE_RANGE) * 50;
    return value >= 0 ? { left: 50, width: pct } : { left: 50 - pct, width: pct };
  }
  return { left: 0, width: Math.max(0, Math.min(1, value)) * 100 };
}

const rowHtml = (r) => `
  <div class="debug-row" data-key="${r.id}">
    <span class="debug-label">${r.label}</span>
    <span class="debug-track ${r.kind}"><span class="debug-fill"></span>${
      r.marker != null ? `<span class="debug-marker" style="left:${r.marker * 100}%"></span>` : ''
    }</span>
    <span class="debug-value"></span>
  </div>`;

/**
 * @param container element to render into
 * @param config { settings, calibration }, read every frame so a new
 *               calibration takes effect immediately
 */
export function createDebugPanel(container, config) {
  const { settings } = config;
  const mappedTo = {}; // gesture name -> event type, for labels
  for (const [type, g] of Object.entries(settings.gestureMap)) if (g) mappedTo[g] = type;

  const signalRows = [
    ...ANGLE_ROWS.map((r) => ({ id: r.key, key: r.key, label: r.label, kind: 'angle' })),
    ...USED_BLENDSHAPES.map((name) => ({ id: name, key: name, label: name, kind: 'score' })),
  ];
  const gestureRows = Object.keys(GESTURES).map((name) => ({
    id: `g-${name}`,
    key: name,
    label: mappedTo[name] ? `${name} → ${mappedTo[name]}` : name,
    kind: 'gesture',
    marker: GESTURES[name].thresholdPct?.(settings) ?? settings.thresholdPct,
  }));

  container.classList.add('debug-panel');
  container.innerHTML = `
    <div class="debug-head">FaceSignals <span class="debug-face"></span> <small>(press D to hide)</small></div>
    ${signalRows.map(rowHtml).join('')}
    <div class="debug-head debug-section">Gestures <span class="debug-guard"></span> <small>(activation ÷ range; | = threshold)</small></div>
    ${gestureRows.map(rowHtml).join('')}
    <div class="debug-head debug-section">Events</div>
    <ol class="debug-events" reversed></ol>
  `;

  const faceEl = container.querySelector('.debug-face');
  const guardEl = container.querySelector('.debug-guard');
  const eventsEl = container.querySelector('.debug-events');
  const bind = (r) => {
    const rowEl = container.querySelector(`[data-key="${r.id}"]`);
    return { ...r, fill: rowEl.querySelector('.debug-fill'), value: rowEl.querySelector('.debug-value') };
  };
  const signalCells = signalRows.map(bind);
  const gestureCells = gestureRows.map(bind);

  document.addEventListener('keydown', (e) => {
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'd' || e.key === 'D') container.hidden = !container.hidden;
  });

  const setBar = (cell, value, kind, text) => {
    const { left, width } = barStyle(value, kind);
    cell.fill.style.left = `${left}%`;
    cell.fill.style.width = `${width}%`;
    cell.value.textContent = text;
  };

  return {
    /** @param engineOut result of stepEngine for this frame (events, progress) */
    update(signals, engineOut) {
      for (const ev of engineOut?.events ?? []) {
        const li = document.createElement('li');
        li.textContent = `${ev.type}  @ ${(ev.t / 1000).toFixed(1)}s`;
        eventsEl.prepend(li);
        while (eventsEl.children.length > EVENT_LOG_SIZE) eventsEl.lastChild.remove();
      }
      if (container.hidden) return;

      faceEl.textContent = signals.faceFound ? '● face' : '○ no face';
      faceEl.classList.toggle('lost', !signals.faceFound);
      guardEl.textContent = engineOut?.guarded ? '⏸ guard: mouth active, input ignored' : '';
      for (const c of signalCells) {
        if (c.kind === 'angle') setBar(c, signals[c.key], 'angle', `${signals[c.key].toFixed(0)}°`);
        else {
          const v = signals.blendshapes[c.key] ?? 0;
          setBar(c, v, 'score', v.toFixed(2));
        }
      }
      for (const c of gestureCells) {
        const a = signals.faceFound ? GESTURES[c.key].activation(signals, config.calibration) : 0;
        setBar(c, a, 'score', a.toFixed(2));
        c.fill.classList.toggle('over', a >= c.marker);
      }
    },
  };
}
