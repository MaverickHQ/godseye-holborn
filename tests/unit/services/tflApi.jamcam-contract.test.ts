import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    head: vi.fn(),
  },
}));

describe('tflApi JamCam contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('maps JamCam camera payload from proxy route instead of synthetic static list', async () => {
    vi.stubEnv('VITE_PROXY_BASE_URL', 'https://proxy.example.com');

    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        cameras: [
          {
            id: 'JamCams_00001.00001',
            cameraId: 'JamCams_00001.00001',
            siteName: 'Farringdon Rd/Cowcross St',
            imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00001.jpg',
            imageType: 'image/jpeg',
            lat: 51.52,
            lon: -0.1059,
            lastVerified: '2026-05-28T07:26:34.000Z',
          },
        ],
      },
    } as never);

    const tflApi = await import('@/services/tflApi');
    const cameras = await tflApi.getAllTrafficCameras();

    expect(axios.get).toHaveBeenCalledWith('https://proxy.example.com/api/tfl/cameras');
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({
      id: 'JamCams_00001.00001',
      name: 'Farringdon Rd/Cowcross St',
      coordinates: { lat: 51.52, lng: -0.1059 },
      streamUrl: 'https://proxy.example.com/api/tfl/camera/JamCams_00001.00001/image',
      lastVerified: '2026-05-28T07:26:34.000Z',
      feedType: 'snapshot',
    });
    expect(typeof cameras[0]?.sourceCheckedAt).toBe('string');
    expect(Number.isNaN(Date.parse(cameras[0]?.sourceCheckedAt || ''))).toBe(false);
  });

  it('uses proxy response timestamp fallback when camera rows omit lastVerified', async () => {
    vi.stubEnv('VITE_PROXY_BASE_URL', 'https://proxy.example.com');

    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        cameras: [
          {
            id: 'JamCams_00001.00001',
            cameraId: 'JamCams_00001.00001',
            siteName: 'Farringdon Rd/Cowcross St',
            imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00001.jpg',
            imageType: 'image/jpeg',
            lat: 51.52,
            lon: -0.1059,
            lastVerified: '',
          },
        ],
      },
      headers: {
        date: 'Fri, 29 May 2026 09:30:00 GMT',
      },
    } as never);

    const tflApi = await import('@/services/tflApi');
    const cameras = await tflApi.getAllTrafficCameras();

    expect(cameras).toHaveLength(1);
    expect(cameras[0]?.lastVerified).toBe('2026-05-29T09:30:00.000Z');
    expect(cameras[0]?.sourceCheckedAt).toBe('2026-05-29T09:30:00.000Z');
  });

  it('propagates proxy response timestamp into local fallback cameras when proxy payload is schema-invalid', async () => {
    vi.stubEnv('VITE_PROXY_BASE_URL', 'https://proxy.example.com');

    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        cameras: [
          {
            id: 'tfl-holborn-roundabout',
            cameraId: 'holborn-roundabout',
            siteName: 'Holborn Roundabout',
            imageUrl: 'https://api.tfl.gov.uk/trafficcam/cam101',
            imageType: 'image/jpeg',
          },
        ],
      },
      headers: {
        date: 'Fri, 29 May 2026 09:35:00 GMT',
      },
    } as never);

    const tflApi = await import('@/services/tflApi');
    const cameras = await tflApi.getAllTrafficCameras();

    expect(cameras.length).toBeGreaterThan(0);
    expect(cameras[0]?.id).toBe('JamCams_00001.03608');
    expect(cameras[0]?.streamUrl).toBe(
      'https://proxy.example.com/api/tfl/camera/JamCams_00001.03608/image',
    );
    expect(cameras[0]?.lastVerified).toBe('2026-05-29T09:35:00.000Z');
    expect(cameras[0]?.sourceCheckedAt).toBe('2026-05-29T09:35:00.000Z');
  });

  it('resolves snapshot metadata via proxy camera endpoint instead of browser-side HEAD requests', async () => {
    vi.stubEnv('VITE_PROXY_BASE_URL', 'https://proxy.example.com');

    const axios = (await import('axios')).default;
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: 'JamCams_00001.00001',
        cameraId: 'JamCams_00001.00001',
        siteName: 'Farringdon Rd/Cowcross St',
        imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00001.jpg',
        imageType: 'image/jpeg',
        lat: 51.52,
        lon: -0.1059,
        lastVerified: '2026-05-29T20:00:44.000Z',
      },
    } as never);

    const tflApi = await import('@/services/tflApi');
    const metadata = await tflApi.getCameraSnapshotMetadata('JamCams_00001.00001');

    expect(axios.get).toHaveBeenCalledWith(
      'https://proxy.example.com/api/tfl/camera/JamCams_00001.00001',
    );
    expect(axios.head).not.toHaveBeenCalled();
    expect(metadata).toEqual({
      status: 'active',
      imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00001.jpg',
      lastVerified: '2026-05-29T20:00:44.000Z',
    });
  });
});
