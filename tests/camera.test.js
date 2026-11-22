import { describe, it, expect, vi } from 'vitest';
import { cameraErrorCode, startCamera, stopCamera } from '../src/vision/camera.js';
import { STRINGS } from '../src/ui/strings-ms.js';

const namedError = (name) => Object.assign(new Error(name), { name });
const fakeVideo = () => ({ srcObject: null, play: vi.fn().mockResolvedValue() });

describe('cameraErrorCode', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'notFound'],
    ['OverconstrainedError', 'notFound'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['SomethingWeird', 'unknown'],
  ])('%s -> %s', (name, code) => {
    expect(cameraErrorCode(namedError(name))).toBe(code);
  });

  it('handles a missing error object', () => {
    expect(cameraErrorCode(undefined)).toBe('unknown');
  });
});

describe('startCamera', () => {
  it('attaches the stream and plays the video on success', async () => {
    const stream = { getTracks: () => [] };
    const devices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
    const video = fakeVideo();

    const result = await startCamera(video, devices);

    expect(result).toEqual({ ok: true, stream });
    expect(video.srcObject).toBe(stream);
    expect(video.play).toHaveBeenCalled();
    expect(devices.getUserMedia.mock.calls[0][0].audio).toBe(false); // never the mic
  });

  it('returns an error code instead of throwing when permission is denied', async () => {
    const devices = { getUserMedia: vi.fn().mockRejectedValue(namedError('NotAllowedError')) };
    const result = await startCamera(fakeVideo(), devices);
    expect(result).toEqual({ ok: false, code: 'denied' });
  });

  it('reports unsupported when the browser has no camera API', async () => {
    expect(await startCamera(fakeVideo(), undefined)).toEqual({ ok: false, code: 'unsupported' });
  });
});

describe('stopCamera', () => {
  it('stops every track', () => {
    const track = { stop: vi.fn() };
    stopCamera({ getTracks: () => [track, track] });
    expect(track.stop).toHaveBeenCalledTimes(2);
  });
});

describe('Malay camera messages', () => {
  it('has a message for every error code', () => {
    for (const code of ['denied', 'notFound', 'busy', 'unsupported', 'unknown']) {
      expect(STRINGS.cameraErrors[code]).toBeTruthy();
    }
  });
});
