// Runs MediaPipe Face Landmarker on video frames, fully offline: the WASM
// runtime and model are served from /public (see scripts/setup-mediapipe.mjs).
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { toFaceSignals } from './face-signals.js';

// BASE_URL is '/' in development and '/WOCA/' on GitHub Pages (vite.config.js).
export const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
export const MODEL_PATH = `${import.meta.env.BASE_URL}models/face_landmarker.task`;

/**
 * Reduce MediaPipe's raw result to the plain data we care about.
 * Pure function, so it can be tested without a camera.
 */
export function summarizeResult(result) {
  const landmarks = result?.faceLandmarks?.[0];
  if (!landmarks?.length) {
    return { faceFound: false, landmarkCount: 0, blendshapes: {}, matrix: null };
  }
  const blendshapes = {};
  for (const c of result.faceBlendshapes?.[0]?.categories ?? []) {
    blendshapes[c.categoryName] = c.score;
  }
  return {
    faceFound: true,
    landmarkCount: landmarks.length,
    blendshapes,
    matrix: result.facialTransformationMatrixes?.[0]?.data ?? null,
  };
}

async function createLandmarker(vision, delegate) {
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numFaces: 1, // only the user; ignore visitors in the background
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

/** Load the model. Tries the GPU first, falls back to CPU. */
export async function createFaceTracker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  let landmarker;
  let delegate = 'GPU';
  try {
    landmarker = await createLandmarker(vision, 'GPU');
  } catch (error) {
    console.warn('[face-tracker] GPU unavailable, using CPU', error);
    delegate = 'CPU';
    landmarker = await createLandmarker(vision, 'CPU');
  }

  let lastTimestamp = -1;
  return {
    delegate,
    /** Detect on the current video frame. Returns a FaceSignals object. */
    detect(video, timestampMs) {
      // MediaPipe requires strictly increasing timestamps in VIDEO mode.
      const t = Math.max(timestampMs, lastTimestamp + 1);
      lastTimestamp = t;
      return toFaceSignals(summarizeResult(landmarker.detectForVideo(video, t)), t);
    },
    close() {
      landmarker.close();
    },
  };
}
