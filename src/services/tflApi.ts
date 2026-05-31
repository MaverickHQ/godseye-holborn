/// <reference types="vite/client" />

import axios from 'axios';
import { CAMERA_SOURCES } from '@/config/cameraSources';
import type { CameraSource, CameraStatus } from '@/types';
import { normalizeJamCamItem, normalizeJamCamPayload, type JamCamCameraRecord } from './tflJamcamAdapter';

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || '';
const USE_PROXY = Boolean(PROXY_BASE_URL);
const TFL_PROXY_BASE = PROXY_BASE_URL ? `${PROXY_BASE_URL}/api/tfl` : '';

const TARGET_LAT = 51.5185;
const TARGET_LNG = -0.1065;
const HOLBORN_CAMERA_LIMIT = 20;

export interface CameraSnapshotMetadata {
  status: CameraStatus;
  imageUrl: string | null;
  lastVerified: string | null;
}

interface JamCamFetchResult {
  records: JamCamCameraRecord[];
  fetchedAt: string;
}

function toFallbackJamCamRecords(timestampFallback?: string | null): JamCamCameraRecord[] {
  return CAMERA_SOURCES.map(source => ({
    id: source.id,
    cameraId: source.id,
    siteName: source.name,
    imageUrl: source.streamUrl,
    imageType: 'image/jpeg',
    lat: source.coordinates.lat,
    lon: source.coordinates.lng,
    lastVerified: source.lastVerified?.trim() || timestampFallback || '',
  }));
}

function distanceSquared(lat: number, lng: number): number {
  const latDelta = lat - TARGET_LAT;
  const lngDelta = lng - TARGET_LNG;
  return latDelta * latDelta + lngDelta * lngDelta;
}

function selectHolbornCameras(records: JamCamCameraRecord[]): JamCamCameraRecord[] {
  return [...records]
    .sort((a, b) => distanceSquared(a.lat, a.lon) - distanceSquared(b.lat, b.lon))
    .slice(0, HOLBORN_CAMERA_LIMIT);
}

function toCameraSource(record: JamCamCameraRecord, sourceCheckedAt: string): CameraSource {
  const proxySnapshotUrl = getTrafficCameraProxyImageUrl(record.id);

  return {
    id: record.id,
    name: record.siteName,
    type: 'traffic',
    provider: 'tfl',
    coordinates: {
      lat: record.lat,
      lng: record.lon,
    },
    // Prefer proxy image URLs so local and AWS runtimes follow the same delivery path.
    streamUrl: proxySnapshotUrl || record.imageUrl,
    status: 'unknown',
    lastVerified: record.lastVerified,
    sourceCheckedAt,
    feedType: 'snapshot',
  };
}

function readHeaderValue(headers: unknown, key: string): string | null {
  if (!headers || typeof headers !== 'object') {
    return null;
  }
  const candidate = (headers as Record<string, unknown>)[key] ?? (headers as Record<string, unknown>)[key.toLowerCase()];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function parseHeaderTimestamp(headers: unknown): string | null {
  const lastModified = readHeaderValue(headers, 'Last-Modified');
  const fallbackDate = readHeaderValue(headers, 'Date');
  const candidate = lastModified || fallbackDate;
  if (!candidate) return null;

  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseIsoTimestamp(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyTimestampFallback(
  records: JamCamCameraRecord[],
  payload: unknown,
  headers: unknown,
): JamCamCameraRecord[] {
  if (records.length === 0) {
    return records;
  }

  const payloadFetchedAt = isObjectRecord(payload) ? payload.fetchedAt : undefined;
  const timestampFallback = parseIsoTimestamp(payloadFetchedAt) || parseHeaderTimestamp(headers);
  if (!timestampFallback) {
    return records;
  }

  return records.map(record =>
    record.lastVerified?.trim()
      ? record
      : {
          ...record,
          lastVerified: timestampFallback,
        },
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

async function fetchJamCamRecords(): Promise<JamCamFetchResult> {
  if (!USE_PROXY) {
    console.warn('TfL proxy base URL is not configured; serving fallback Holborn snapshot manifest only.');
    const fetchedAt = nowIso();
    return {
      records: toFallbackJamCamRecords(fetchedAt),
      fetchedAt,
    };
  }

  try {
    const response = await axios.get(`${TFL_PROXY_BASE}/cameras`);
    const responseTimestamp =
      parseIsoTimestamp(isObjectRecord(response.data) ? response.data.fetchedAt : undefined) ||
      parseHeaderTimestamp(response.headers) ||
      nowIso();
    const records = applyTimestampFallback(normalizeJamCamPayload(response.data), response.data, response.headers);
    return {
      records: records.length > 0 ? records : toFallbackJamCamRecords(responseTimestamp),
      fetchedAt: responseTimestamp,
    };
  } catch (error) {
    console.error('Failed to fetch cameras via proxy:', error);
    const responseHeaders =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { headers?: unknown } }).response?.headers
        : undefined;
    const errorTimestamp = parseHeaderTimestamp(responseHeaders) || nowIso();
    return {
      records: toFallbackJamCamRecords(errorTimestamp),
      fetchedAt: errorTimestamp,
    };
  }
}

export async function getTrafficCameras(): Promise<CameraSource[]> {
  const { records, fetchedAt } = await fetchJamCamRecords();
  const selected = selectHolbornCameras(records);
  return selected.map(record => toCameraSource(record, fetchedAt));
}

export async function getTrafficCameraImage(cameraId: string): Promise<string | null> {
  if (!USE_PROXY) {
    const fallback = CAMERA_SOURCES.find(source => source.id === cameraId);
    return fallback?.streamUrl ?? null;
  }

  try {
    const response = await axios.get(`${TFL_PROXY_BASE}/camera/${encodeURIComponent(cameraId)}`);
    const record = normalizeJamCamItem(response.data);
    return record?.imageUrl || null;
  } catch (error) {
    console.error(`Failed to get camera image via proxy for ${cameraId}:`, error);
    return null;
  }
}

export function getTrafficCameraProxyImageUrl(cameraId: string): string | null {
  if (!USE_PROXY || !cameraId) {
    return null;
  }

  return `${TFL_PROXY_BASE}/camera/${encodeURIComponent(cameraId)}/image`;
}

export async function checkCameraStatus(cameraId: string): Promise<CameraStatus> {
  const metadata = await getCameraSnapshotMetadata(cameraId);
  return metadata.status;
}

export async function getCameraSnapshotMetadata(
  cameraId: string,
  streamUrl?: string,
): Promise<CameraSnapshotMetadata> {
  if (USE_PROXY) {
    try {
      const response = await axios.get(`${TFL_PROXY_BASE}/camera/${encodeURIComponent(cameraId)}`);
      const record = normalizeJamCamItem(response.data);
      const headerTimestamp = parseHeaderTimestamp(response.headers);
      const lastVerified = parseIsoTimestamp(record?.lastVerified) || headerTimestamp;

      if (record?.imageUrl) {
        return {
          status: 'active',
          imageUrl: record.imageUrl,
          lastVerified,
        };
      }
    } catch (error) {
      console.error(`Failed to get camera snapshot metadata via proxy for ${cameraId}:`, error);
    }
  }

  const imageUrl = streamUrl || (await getTrafficCameraImage(cameraId));

  if (!imageUrl) {
    return {
      status: 'unknown',
      imageUrl: null,
      lastVerified: null,
    };
  }

  try {
    const response = await axios.head(imageUrl, { timeout: 5000 });
    const lastVerified = parseHeaderTimestamp(response.headers);
    return {
      status: response.status >= 200 && response.status < 300 ? 'active' : 'unknown',
      imageUrl,
      lastVerified,
    };
  } catch {
    return {
      status: 'unknown',
      imageUrl,
      lastVerified: null,
    };
  }
}

export async function getAllTrafficCameras(): Promise<CameraSource[]> {
  return getTrafficCameras();
}

export async function getCameraById(cameraId: string): Promise<CameraSource | null> {
  const cameras = await getAllTrafficCameras();
  return cameras.find(c => c.id === cameraId) || null;
}

export default {
  getTrafficCameras,
  getTrafficCameraImage,
  getTrafficCameraProxyImageUrl,
  checkCameraStatus,
  getCameraSnapshotMetadata,
  getAllTrafficCameras,
  getCameraById,
};
