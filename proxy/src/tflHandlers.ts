import { normalizeJamCamItem, normalizeJamCamList } from './jamcamAdapter';
import { binaryResponse, jsonResponse, routeError } from './response';
import type { ApiGatewayProxyResultV2Like } from './types';

const DEFAULT_UPSTREAM_TIMEOUT_MS = 8000;
const TFL_BASE_URL = 'https://api.tfl.gov.uk';

type FallbackCamera = {
  id: string;
  cameraId: string;
  siteName: string;
  imageUrl: string;
  imageType: string;
  lat: number;
  lon: number;
  lastVerified?: string;
};

const FALLBACK_TFL_CAMERAS = [
  {
    id: 'JamCams_00001.00001',
    cameraId: 'JamCams_00001.00001',
    siteName: 'Holborn Roundabout',
    imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00001.jpg',
    imageType: 'image/jpeg',
    lat: 51.5185,
    lon: -0.1065,
  },
  {
    id: 'JamCams_00002.00865',
    cameraId: 'JamCams_00002.00865',
    siteName: 'Farringdon Rd/Cowcross St',
    imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.00865.jpg',
    imageType: 'image/jpeg',
    lat: 51.52,
    lon: -0.1059,
  },
  {
    id: 'JamCams_00001.00126',
    cameraId: 'JamCams_00001.00126',
    siteName: 'Rosebery Av/Mount Pleasant',
    imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.00126.jpg',
    imageType: 'image/jpeg',
    lat: 51.5246,
    lon: -0.111,
  },
] satisfies FallbackCamera[];

function normalizeUpstreamErrorStatus(_upstreamStatus: number): number {
  return 502;
}

function getUpstreamTimeoutMs(): number {
  const raw = Number(process.env.UPSTREAM_TIMEOUT_MS || DEFAULT_UPSTREAM_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_UPSTREAM_TIMEOUT_MS;
  }

  return Math.min(Math.floor(raw), 30000);
}

export function getTflApiKey(): string {
  return process.env.TFL_API_KEY || '';
}

export function isTflFallbackEnabled(): boolean {
  return process.env.ENABLE_TFL_FALLBACK === 'true';
}

function buildTflUpstreamUrl(path: string, apiKey: string): string {
  const url = new URL(`${TFL_BASE_URL}${path}`);
  if (apiKey) {
    url.searchParams.set('app_key', apiKey);
  }
  return url.toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error
    ? error.name === 'AbortError'
    : typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError';
}

function parseHttpDateToIso(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

async function resolveSnapshotLastVerifiedFromImage(imageUrl: string): Promise<string | null> {
  try {
    const upstream = await fetchWithTimeout(imageUrl, {
      method: 'HEAD',
    });

    if (!upstream.ok) {
      return null;
    }

    return (
      parseHttpDateToIso(upstream.headers.get('Last-Modified')) || parseHttpDateToIso(upstream.headers.get('Date'))
    );
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getUpstreamTimeoutMs());

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseUpstreamJson(upstream: Response): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  try {
    const payload = await upstream.json();
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

type NormalizedCameraRecord = Exclude<ReturnType<typeof normalizeJamCamItem>, null>;

type CameraRecordResult =
  | { kind: 'ok'; record: NormalizedCameraRecord }
  | { kind: 'invalid_payload' }
  | { kind: 'upstream_error'; status: number };

async function fetchNormalizedCameraRecord(
  cameraId: string,
  apiKey: string,
): Promise<CameraRecordResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const upstream = await fetchWithTimeout(buildTflUpstreamUrl(`/Place/${encodeURIComponent(cameraId)}`, apiKey), {
    headers,
  });

  const parsed = await parseUpstreamJson(upstream);
  if (!parsed.ok) {
    return { kind: 'invalid_payload' };
  }

  if (!upstream.ok) {
    return { kind: 'upstream_error', status: upstream.status };
  }

  const normalized = normalizeJamCamItem(parsed.payload);
  if (!normalized) {
    return { kind: 'invalid_payload' };
  }

  return { kind: 'ok', record: normalized };
}

function enrichFallbackCamera(camera: FallbackCamera, observedAtIso: string): FallbackCamera {
  return {
    ...camera,
    lastVerified: camera.lastVerified || observedAtIso,
  };
}

function fallbackCameraPayload(observedAtIso: string) {
  return {
    cameras: FALLBACK_TFL_CAMERAS.map(camera => enrichFallbackCamera(camera, observedAtIso)),
    source: 'fallback',
    snapshot: true,
    fetchedAt: observedAtIso,
  };
}

export function resolveFallbackCamera(cameraId: string): FallbackCamera | null {
  return FALLBACK_TFL_CAMERAS.find(camera => camera.cameraId === cameraId || camera.id === cameraId) ?? null;
}

function fallbackListResponse(
  observedAtIso: string,
  corsHeaders: Record<string, string>,
): ApiGatewayProxyResultV2Like {
  return jsonResponse(200, fallbackCameraPayload(observedAtIso), corsHeaders);
}

function fallbackCameraResponse(
  cameraId: string,
  observedAtIso: string,
  corsHeaders: Record<string, string>,
): ApiGatewayProxyResultV2Like | null {
  const fallback = resolveFallbackCamera(cameraId);
  if (!fallback) {
    return null;
  }

  return jsonResponse(200, enrichFallbackCamera(fallback, observedAtIso), corsHeaders);
}

export async function handleTflCameras(corsHeaders: Record<string, string>): Promise<ApiGatewayProxyResultV2Like> {
  const apiKey = getTflApiKey();
  const observedAtIso = new Date().toISOString();

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const upstream = await fetchWithTimeout(buildTflUpstreamUrl('/Place/Type/JamCam', apiKey), {
      headers,
    });

    const parsed = await parseUpstreamJson(upstream);
    if (!parsed.ok) {
      if (isTflFallbackEnabled()) {
        return fallbackListResponse(observedAtIso, corsHeaders);
      }
      return routeError('Invalid upstream response format', 502, corsHeaders);
    }

    if (!upstream.ok) {
      if (isTflFallbackEnabled()) {
        return fallbackListResponse(observedAtIso, corsHeaders);
      }
      return routeError('Upstream service error', normalizeUpstreamErrorStatus(upstream.status), corsHeaders);
    }

    const normalized = normalizeJamCamList(parsed.payload);
    if (normalized.length === 0) {
      if (isTflFallbackEnabled()) {
        return fallbackListResponse(observedAtIso, corsHeaders);
      }
      return routeError('Invalid upstream response format', 502, corsHeaders);
    }

    return jsonResponse(
      200,
      {
        cameras: normalized,
        source: 'tfl-jamcam',
        snapshot: true,
        fetchedAt: observedAtIso,
      },
      corsHeaders,
    );
  } catch (error) {
    if (isAbortError(error)) {
      if (isTflFallbackEnabled()) {
        return fallbackListResponse(observedAtIso, corsHeaders);
      }
      return routeError('Upstream timeout', 504, corsHeaders);
    }

    console.error('TfL cameras proxy error:', error);
    if (isTflFallbackEnabled()) {
      return fallbackListResponse(observedAtIso, corsHeaders);
    }
    return routeError('Failed to fetch cameras', 502, corsHeaders);
  }
}

export async function handleTflCamera(
  cameraId: string,
  corsHeaders: Record<string, string>,
): Promise<ApiGatewayProxyResultV2Like> {
  if (!cameraId) {
    return routeError('Invalid camera ID', 400, corsHeaders);
  }

  const apiKey = getTflApiKey();
  const observedAtIso = new Date().toISOString();

  const tryFallback = () =>
    isTflFallbackEnabled() ? fallbackCameraResponse(cameraId, observedAtIso, corsHeaders) : null;

  try {
    const cameraRecord = await fetchNormalizedCameraRecord(cameraId, apiKey);
    if (cameraRecord.kind === 'invalid_payload') {
      const fallback = tryFallback();
      if (fallback) {
        return fallback;
      }
      return routeError('Invalid upstream response format', 502, corsHeaders);
    }

    if (cameraRecord.kind === 'upstream_error') {
      const fallback = tryFallback();
      if (fallback) {
        return fallback;
      }
      return routeError('Upstream service error', normalizeUpstreamErrorStatus(cameraRecord.status), corsHeaders);
    }

    const lastVerifiedFromImage = await resolveSnapshotLastVerifiedFromImage(cameraRecord.record.imageUrl);
    const payload = lastVerifiedFromImage
      ? {
          ...cameraRecord.record,
          lastVerified: lastVerifiedFromImage,
        }
      : cameraRecord.record;

    return jsonResponse(200, payload, corsHeaders);
  } catch (error) {
    if (isAbortError(error)) {
      const fallback = tryFallback();
      if (fallback) {
        return fallback;
      }
      return routeError('Upstream timeout', 504, corsHeaders);
    }

    console.error('TfL camera proxy error:', error);
    const fallback = tryFallback();
    if (fallback) {
      return fallback;
    }
    return routeError('Failed to fetch camera', 502, corsHeaders);
  }
}

export async function handleTflCameraImage(
  cameraId: string,
  corsHeaders: Record<string, string>,
): Promise<ApiGatewayProxyResultV2Like> {
  if (!cameraId) {
    return routeError('Invalid camera ID', 400, corsHeaders);
  }

  const apiKey = getTflApiKey();
  const observedAtIso = new Date().toISOString();
  const fallback = resolveFallbackCamera(cameraId);

  try {
    const cameraRecord = await fetchNormalizedCameraRecord(cameraId, apiKey);
    let imageUrl = '';

    if (cameraRecord.kind === 'ok') {
      imageUrl = cameraRecord.record.imageUrl;
    } else if (fallback) {
      imageUrl = enrichFallbackCamera(fallback, observedAtIso).imageUrl;
    } else if (cameraRecord.kind === 'upstream_error') {
      return routeError('Upstream service error', normalizeUpstreamErrorStatus(cameraRecord.status), corsHeaders);
    } else {
      return routeError('Invalid upstream response format', 502, corsHeaders);
    }

    const upstreamImage = await fetchWithTimeout(imageUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/*',
      },
    });

    if (!upstreamImage.ok) {
      return routeError('Failed to fetch camera image', 502, corsHeaders);
    }

    const imageBuffer = new Uint8Array(await upstreamImage.arrayBuffer());
    const contentType = upstreamImage.headers.get('Content-Type') || 'image/jpeg';
    const lastModified = upstreamImage.headers.get('Last-Modified') || new Date().toUTCString();

    return binaryResponse(200, imageBuffer, contentType, corsHeaders, {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      'Last-Modified': lastModified,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return routeError('Upstream timeout', 504, corsHeaders);
    }

    console.error('TfL camera image proxy error:', error);
    return routeError('Failed to fetch camera image', 502, corsHeaders);
  }
}
