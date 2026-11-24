// Pure conversion: MediaPipe summary -> FaceSignals (see docs/infrastructure.md).
// No camera or browser APIs here, so it is fully unit-testable.

/** Blendshapes the gesture engine may use. Others are dropped. */
export const USED_BLENDSHAPES = Object.freeze([
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookOutLeft',
  'eyeLookInLeft',
  'eyeLookUpLeft',
  'eyeLookDownLeft',
  'eyeLookOutRight',
  'eyeLookInRight',
  'eyeLookUpRight',
  'eyeLookDownRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'jawOpen',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
]);

// Sign conventions so that: +yaw = the user turns to THEIR left, +pitch = chin up,
// +roll = head tilts toward the user's left shoulder. If live testing shows a sign is
// backwards, flip it here (and the round-trip tests still hold).
const YAW_SIGN = 1;
const PITCH_SIGN = -1;
const ROLL_SIGN = 1;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Extract yaw/pitch/roll in degrees from MediaPipe's 4x4 facial transformation
 * matrix (column-major, 16 numbers). Decomposition R = Ry(yaw)·Rx(pitch)·Rz(roll),
 * chosen so yaw stays accurate even when the user's head is pitched back on a pillow.
 */
export function headAnglesFromMatrix(m) {
  if (!m || m.length < 16) return null;
  // r(row, col) for a column-major matrix; normalise columns to strip any scale.
  const col = (c) => {
    const x = m[c * 4], y = m[c * 4 + 1], z = m[c * 4 + 2];
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  };
  const c0 = col(0), c1 = col(1), c2 = col(2);
  const r = (row, c) => [c0, c1, c2][c][row];

  const pitch = Math.asin(Math.max(-1, Math.min(1, -r(1, 2))));
  const yaw = Math.atan2(r(0, 2), r(2, 2));
  const roll = Math.atan2(r(1, 0), r(1, 1));

  return {
    yaw: YAW_SIGN * yaw * RAD_TO_DEG,
    pitch: PITCH_SIGN * pitch * RAD_TO_DEG,
    roll: ROLL_SIGN * roll * RAD_TO_DEG,
  };
}

/** Build one FaceSignals frame. A face without a usable pose counts as not found. */
export function toFaceSignals(summary, t) {
  const angles = summary?.faceFound ? headAnglesFromMatrix(summary.matrix) : null;
  if (!angles) {
    return { t, faceFound: false, yaw: 0, pitch: 0, roll: 0, blendshapes: {} };
  }
  const blendshapes = {};
  for (const name of USED_BLENDSHAPES) blendshapes[name] = summary.blendshapes[name] ?? 0;
  return { t, faceFound: true, ...angles, blendshapes };
}
