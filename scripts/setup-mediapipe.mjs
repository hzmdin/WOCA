// Copies MediaPipe's WASM runtime into /public and downloads the face model
// once, so the app runs fully offline afterwards. Runs on `npm install`.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = path.join(root, 'public', 'mediapipe', 'wasm');
const modelPath = path.join(root, 'public', 'models', 'face_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function exists(p) {
  try {
    return (await stat(p)).size > 0;
  } catch {
    return false;
  }
}

await mkdir(wasmDest, { recursive: true });
await cp(wasmSrc, wasmDest, { recursive: true });
console.log('[setup] copied MediaPipe WASM -> public/mediapipe/wasm');

if (await exists(modelPath)) {
  console.log('[setup] face model already present');
} else {
  console.log('[setup] downloading face model (one time)...');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  await mkdir(path.dirname(modelPath), { recursive: true });
  await writeFile(modelPath, Buffer.from(await res.arrayBuffer()));
  console.log('[setup] saved public/models/face_landmarker.task');
}
