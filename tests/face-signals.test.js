import { describe, it, expect } from 'vitest';
import { headAnglesFromMatrix, toFaceSignals, USED_BLENDSHAPES } from '../src/vision/face-signals.js';

const DEG = Math.PI / 180;

// 3x3 helpers (row-major arrays of rows)
const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, _, k) => s + row[k] * B[k][j], 0)));
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

/** Build MediaPipe-style column-major 4x4 from raw (unsigned) angles in degrees. */
function matrix({ yaw = 0, pitch = 0, roll = 0, scale = 1, tx = 0, ty = 0, tz = -50 }) {
  const R = mul(mul(Ry(yaw * DEG), Rx(pitch * DEG)), Rz(roll * DEG));
  const m = new Array(16).fill(0);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] = R[r][c] * scale;
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
  return m;
}

const close = (a, b) => expect(a).toBeCloseTo(b, 4);

describe('headAnglesFromMatrix', () => {
  it('identity -> all zero', () => {
    const a = headAnglesFromMatrix(matrix({}));
    close(a.yaw, 0); close(a.pitch, 0); close(a.roll, 0);
  });

  it.each([
    { yaw: 20 }, { yaw: -30 }, { pitch: 15 }, { pitch: -25 }, { roll: 10 },
    { yaw: 25, pitch: -20, roll: 5 }, // turned while reclined on a pillow
  ])('round-trips %o (pitch sign flipped so + = chin up)', (raw) => {
    const a = headAnglesFromMatrix(matrix(raw));
    close(a.yaw, raw.yaw ?? 0);
    close(a.pitch, -(raw.pitch ?? 0));
    close(a.roll, raw.roll ?? 0);
  });

  it('yaw is unaffected by a large head-back pitch (reclined bed)', () => {
    close(headAnglesFromMatrix(matrix({ yaw: 20, pitch: -35 })).yaw, 20);
  });

  it('ignores scale and translation', () => {
    const a = headAnglesFromMatrix(matrix({ yaw: 12, scale: 3.7, tx: 5, ty: -2, tz: -80 }));
    close(a.yaw, 12);
  });

  it('returns null for a missing matrix', () => {
    expect(headAnglesFromMatrix(null)).toBeNull();
    expect(headAnglesFromMatrix([1, 2, 3])).toBeNull();
  });
});

describe('toFaceSignals', () => {
  const summary = (overrides = {}) => ({
    faceFound: true,
    landmarkCount: 478,
    blendshapes: { eyeBlinkLeft: 0.81, browInnerUp: 0.3 },
    matrix: matrix({ yaw: 10 }),
    ...overrides,
  });

  it('builds a full frame with angles and only the used blendshapes', () => {
    const s = toFaceSignals(summary(), 1234);
    expect(s.t).toBe(1234);
    expect(s.faceFound).toBe(true);
    close(s.yaw, 10);
    expect(Object.keys(s.blendshapes)).toEqual([...USED_BLENDSHAPES]);
    expect(s.blendshapes.eyeBlinkLeft).toBe(0.81);
    expect(s.blendshapes.eyeBlinkRight).toBe(0); // missing -> 0
    expect(s.blendshapes.browInnerUp).toBeUndefined(); // unused -> dropped
  });

  it('no face -> faceFound false with neutral values', () => {
    expect(toFaceSignals({ faceFound: false }, 5)).toEqual({
      t: 5, faceFound: false, yaw: 0, pitch: 0, roll: 0, blendshapes: {},
    });
  });

  it('face without a pose matrix counts as not found (never act on partial data)', () => {
    expect(toFaceSignals(summary({ matrix: null }), 5).faceFound).toBe(false);
  });
});
