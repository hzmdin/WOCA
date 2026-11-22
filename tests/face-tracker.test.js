import { describe, it, expect, vi } from 'vitest';

// The real MediaPipe package needs a browser; we only test our pure helper.
vi.mock('@mediapipe/tasks-vision', () => ({ FaceLandmarker: {}, FilesetResolver: {} }));
const { summarizeResult, WASM_PATH, MODEL_PATH } = await import('../src/vision/face-tracker.js');

describe('summarizeResult', () => {
  it('reports no face for an empty result', () => {
    expect(summarizeResult({ faceLandmarks: [] })).toEqual({
      faceFound: false,
      landmarkCount: 0,
      blendshapes: {},
      matrix: null,
    });
  });

  it('reports no face for a missing result', () => {
    expect(summarizeResult(undefined).faceFound).toBe(false);
  });

  it('flattens blendshapes into a name -> score map', () => {
    const result = {
      faceLandmarks: [new Array(478).fill({ x: 0, y: 0, z: 0 })],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: 'eyeBlinkLeft', score: 0.9 },
            { categoryName: 'mouthSmileLeft', score: 0.1 },
          ],
        },
      ],
      facialTransformationMatrixes: [{ rows: 4, columns: 4, data: new Array(16).fill(0) }],
    };
    const summary = summarizeResult(result);
    expect(summary.faceFound).toBe(true);
    expect(summary.landmarkCount).toBe(478);
    expect(summary.blendshapes).toEqual({ eyeBlinkLeft: 0.9, mouthSmileLeft: 0.1 });
    expect(summary.matrix).toHaveLength(16);
  });
});

describe('offline asset paths', () => {
  it('loads WASM and model from our own server, never a CDN', () => {
    expect(WASM_PATH.startsWith('/')).toBe(true);
    expect(MODEL_PATH.startsWith('/')).toBe(true);
  });
});
