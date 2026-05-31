import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimiterForTests, handler } from '../../../proxy/src/index';

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

describe('Lambda proxy security contract', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGIN = 'https://godseye.example';
    process.env.TFL_API_KEY = 'test-key';
    process.env.UPSTREAM_TIMEOUT_MS = '2500';
    process.env.RATE_LIMIT_MAX = '100';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    __resetRateLimiterForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.TFL_API_KEY;
    delete process.env.UPSTREAM_TIMEOUT_MS;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('does not allow localhost origins when ALLOWED_ORIGIN is a production domain', async () => {
    const event = buildEvent({
      rawPath: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });

    const response = await handler(event as never);
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('https://godseye.example');
  });

  it('returns 404 for unknown routes without touching upstream fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({
      rawPath: '/api/legacy/unknown-route',
    });

    const response = await handler(event as never);
    expect(response.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes upstream 4xx responses into safe proxy error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too many requests' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });
    const response = await handler(event as never);

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error).toMatch(/upstream/i);
  });

  it('returns safe 502 when upstream payload is not valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token <');
      },
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });
    const response = await handler(event as never);

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error).toMatch(/invalid upstream response/i);
  });

  it('maps abort/timeouts to 504 gateway timeout response', async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({ rawPath: '/api/tfl/cameras' });
    const response = await handler(event as never);

    expect(response.statusCode).toBe(504);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error).toMatch(/timeout/i);
  });

  it('enforces per-client rate limiting for tfL routes', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    __resetRateLimiterForTests();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 'JamCams_00001',
          commonName: 'Farringdon Rd/Cowcross St',
          lat: 51.52,
          lon: -0.1059,
          additionalProperties: [
            {
              key: 'imageUrl',
              value: 'https://example.com/jamcam-00001.jpg',
            },
          ],
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const event = buildEvent({
      rawPath: '/api/tfl/cameras',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    const first = await handler(event as never);
    const second = await handler(event as never);
    const third = await handler(event as never);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
