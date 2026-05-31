import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../../../proxy/src/index';

type MockEvent = {
  rawPath: string;
  requestContext: { http: { method: string } };
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
};

const buildEvent = (overrides: Partial<MockEvent>): MockEvent => ({
  rawPath: '/api/health',
  requestContext: { http: { method: 'GET' } },
  headers: {},
  ...overrides,
});

describe('Lambda proxy contract', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGIN = 'https://example.com';
    process.env.TFL_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.TFL_API_KEY;
    delete process.env.ENABLE_TFL_FALLBACK;
    vi.useRealTimers();
  });

  it('returns health response for GET /api/health with CORS headers', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'https://example.com' },
    });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://example.com');

    const body = JSON.parse(response.body ?? '{}');
    expect(body.status).toBe('healthy');
  });

  it('returns 204 for CORS preflight requests', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      requestContext: { http: { method: 'OPTIONS' } },
      headers: { origin: 'https://example.com' },
    });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(204);
    expect(response.headers?.['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('returns 405 for unsupported methods', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      requestContext: { http: { method: 'POST' } },
    });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(405);
  });

  it('returns 404 for unknown routes', async () => {
    const event = buildEvent({ rawPath: '/api/unknown' });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(404);
  });

  it('proxies camera list requests to TfL with server-side app_key query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'JamCams_00001.00001',
          commonName: 'Test Camera',
          lat: 51.5185,
          lon: -0.1065,
          additionalProperties: [
            {
              key: 'imageUrl',
              value: 'https://example.com/cam.jpg',
              modified: '2026-05-29T13:14:15.000Z',
            },
          ],
        },
      ]),
      status: 200,
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain('/Place/Type/JamCam');
    expect(url).toContain('app_key=test-key');
    expect(options.headers.app_key).toBeUndefined();

    const body = JSON.parse(response.body ?? '{}');
    expect(body.cameras[0].lastVerified).toBe('2026-05-29T13:14:15.000Z');
  });

  it('does not send app_key to TfL when TFL_API_KEY is not configured', async () => {
    delete process.env.TFL_API_KEY;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'JamCams_00001.00001',
          commonName: 'Test Camera',
          lat: 51.5185,
          lon: -0.1065,
          additionalProperties: [
            { key: 'imageUrl', value: 'https://example.com/cam.jpg' },
          ],
        },
      ]),
      status: 200,
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });
    const response = await handler(event as never);

    expect(response.statusCode).toBe(200);
    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).not.toContain('app_key=');
    expect(options.headers.app_key).toBeUndefined();
  });

  it('proxies single camera requests and resolves snapshot freshness from camera image headers server-side', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'JamCams_00001',
          commonName: 'Test Camera',
          lat: 51.5185,
          lon: -0.1065,
          additionalProperties: [
            { key: 'imageUrl', value: 'https://example.com/cam.jpg' },
            { key: 'lastUpdated', value: '2026-05-26T17:34:51.130Z' },
          ],
        }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'last-modified' ? 'Fri, 29 May 2026 20:00:44 GMT' : null,
        },
        status: 200,
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/camera/JamCams_00001' });

    const response = await handler(event as never);

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain('/Place/JamCams_00001');
    expect(url).toContain('app_key=test-key');
    expect(options.headers.app_key).toBeUndefined();

    const [headUrl, headOptions] = fetchMock.mock.calls[1] as [string, { method: string }];
    expect(headUrl).toBe('https://example.com/cam.jpg');
    expect(headOptions.method).toBe('HEAD');

    const body = JSON.parse(response.body ?? '{}');
    expect(body.lastVerified).toBe('2026-05-29T20:00:44.000Z');
  });

  it('falls back to configured allowed origin when request origin is not trusted', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'https://malicious.example' },
    });

    const response = await handler(event as never);

    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  it('allows localhost origins when explicitly listed in ALLOWED_ORIGIN allowlist', async () => {
    process.env.ALLOWED_ORIGIN = 'https://example.com,http://127.0.0.1:3000,http://localhost:5173';

    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'http://127.0.0.1:3000' },
    });

    const response = await handler(event as never);

    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:3000');
  });

  it('returns complete fallback camera payload with deterministic fetchedAt and per-camera lastVerified', async () => {
    process.env.ENABLE_TFL_FALLBACK = 'true';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T10:00:00.000Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
      status: 502,
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });
    const response = await handler(event as never);
    const body = JSON.parse(response.body ?? '{}');

    expect(response.statusCode).toBe(200);
    expect(body.source).toBe('fallback');
    expect(body.snapshot).toBe(true);
    expect(body.fetchedAt).toBe('2026-05-29T10:00:00.000Z');
    expect(Array.isArray(body.cameras)).toBe(true);
    expect(body.cameras.length).toBeGreaterThan(0);

    body.cameras.forEach((camera: Record<string, unknown>) => {
      expect(typeof camera.id).toBe('string');
      expect(typeof camera.siteName).toBe('string');
      expect(typeof camera.imageUrl).toBe('string');
      expect(typeof camera.lat).toBe('number');
      expect(typeof camera.lon).toBe('number');
      expect(camera.lastVerified).toBe('2026-05-29T10:00:00.000Z');
    });
  });

  it('includes exposed timestamp headers in CORS responses for browser-side diagnostics', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'https://example.com' },
    });

    const response = await handler(event as never);
    const exposedHeaders = response.headers?.['Access-Control-Expose-Headers'] ?? '';

    expect(exposedHeaders.toLowerCase()).toContain('date');
    expect(exposedHeaders.toLowerCase()).toContain('last-modified');
  });

  it('exposes non-secret runtime diagnostics in health response for api key and fallback configuration', async () => {
    process.env.ENABLE_TFL_FALLBACK = 'true';
    process.env.TFL_API_KEY = 'test-key';

    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'https://example.com' },
    });

    const response = await handler(event as never);
    const body = JSON.parse(response.body ?? '{}');

    expect(response.statusCode).toBe(200);
    expect(body.diagnostics).toMatchObject({
      tflApiKeyConfigured: true,
      fallbackEnabled: true,
    });
  });
});
