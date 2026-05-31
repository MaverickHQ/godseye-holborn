export interface CanonicalJamCamCameraRecord {
  id: string;
  cameraId: string;
  siteName: string;
  imageUrl: string;
  imageType: string;
  lat: number;
  lon: number;
  lastVerified: string;
}

interface JamCamAdditionalProperty {
  key?: string;
  value?: string;
  modified?: string;
}

interface JamCamPlace {
  id?: string;
  commonName?: string;
  lat?: number;
  lon?: number;
  additionalProperties?: JamCamAdditionalProperty[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeTimestamp(candidate: unknown): string {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    return '';
  }
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    return '';
  }
  return new Date(parsed).toISOString();
}

function latestTimestamp(candidates: unknown[]): string {
  let latestMs = Number.NEGATIVE_INFINITY;
  let latestIso = '';

  candidates.forEach(candidate => {
    const iso = normalizeTimestamp(candidate);
    if (!iso) return;
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = iso;
    }
  });

  return latestIso;
}

function readAdditionalProperty(place: JamCamPlace, key: string): string {
  const properties = Array.isArray(place.additionalProperties) ? place.additionalProperties : [];
  return properties.find(property => property.key === key)?.value?.trim() ?? '';
}

function normalizeJamCamPlace(candidate: JamCamPlace): CanonicalJamCamCameraRecord | null {
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const siteName = typeof candidate.commonName === 'string' ? candidate.commonName.trim() : '';
  const imageUrl = readAdditionalProperty(candidate, 'imageUrl');

  if (!id || !siteName || !imageUrl || !isFiniteNumber(candidate.lat) || !isFiniteNumber(candidate.lon)) {
    return null;
  }

  const properties = Array.isArray(candidate.additionalProperties) ? candidate.additionalProperties : [];
  const lastVerified = latestTimestamp([
    readAdditionalProperty(candidate, 'lastUpdated'),
    readAdditionalProperty(candidate, 'capturedAt'),
    readAdditionalProperty(candidate, 'updatedAt'),
    ...properties.map(property => property.modified),
  ]);

  return {
    id,
    cameraId: id,
    siteName,
    imageUrl,
    imageType: 'image/jpeg',
    lat: candidate.lat,
    lon: candidate.lon,
    lastVerified,
  };
}

function normalizeJamCamRecord(candidate: Record<string, unknown>): CanonicalJamCamCameraRecord | null {
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const cameraId =
    typeof candidate.cameraId === 'string' && candidate.cameraId.trim() ? candidate.cameraId.trim() : id;
  const siteName =
    typeof candidate.siteName === 'string' && candidate.siteName.trim()
      ? candidate.siteName.trim()
      : typeof candidate.commonName === 'string'
        ? candidate.commonName.trim()
        : '';
  const imageUrl =
    typeof candidate.imageUrl === 'string' && candidate.imageUrl.trim()
      ? candidate.imageUrl.trim()
      : typeof candidate.streamUrl === 'string'
        ? candidate.streamUrl.trim()
        : '';

  const lat = candidate.lat;
  const lon = candidate.lon;
  if (!id || !cameraId || !siteName || !imageUrl || !isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    return null;
  }

  return {
    id,
    cameraId,
    siteName,
    imageUrl,
    imageType:
      typeof candidate.imageType === 'string' && candidate.imageType.trim()
        ? candidate.imageType.trim()
        : 'image/jpeg',
    lat,
    lon,
    lastVerified: normalizeTimestamp(candidate.lastVerified),
  };
}

export function normalizeJamCamPayload(payload: unknown): CanonicalJamCamCameraRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.cameras)
      ? payload.cameras
      : [];

  const records: CanonicalJamCamCameraRecord[] = [];
  rows.forEach(candidate => {
    if (!isRecord(candidate)) return;

    const mapped = 'additionalProperties' in candidate
      ? normalizeJamCamPlace(candidate as unknown as JamCamPlace)
      : normalizeJamCamRecord(candidate);

    if (mapped) {
      records.push(mapped);
    }
  });
  return records;
}

export function normalizeJamCamItem(payload: unknown): CanonicalJamCamCameraRecord | null {
  if (!isRecord(payload)) {
    return null;
  }

  const mapped = 'additionalProperties' in payload
    ? normalizeJamCamPlace(payload as unknown as JamCamPlace)
    : normalizeJamCamRecord(payload);
  return mapped;
}
