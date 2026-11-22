// Opens the webcam and attaches it to a <video> element. No UI text here:
// callers turn the returned error code into a Malay message.
// Frames stay in the browser; nothing is recorded or sent anywhere.

// Ask for a modest resolution: enough for face landmarks, light on the CPU.
const VIDEO_CONSTRAINTS = {
  audio: false,
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
};

/** Map a getUserMedia error to one of our stable codes. */
export function cameraErrorCode(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'notFound';
    case 'NotReadableError':
    case 'AbortError':
      return 'busy'; // usually another app (Zoom, Teams, Camera) holds it
    default:
      return 'unknown';
  }
}

/**
 * Start the camera.
 * @returns {Promise<{ok: true, stream: MediaStream} | {ok: false, code: string}>}
 */
export async function startCamera(videoEl, mediaDevices = navigator.mediaDevices) {
  if (!mediaDevices?.getUserMedia) return { ok: false, code: 'unsupported' };
  try {
    const stream = await mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
    videoEl.srcObject = stream;
    await videoEl.play();
    return { ok: true, stream };
  } catch (error) {
    return { ok: false, code: cameraErrorCode(error) };
  }
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
