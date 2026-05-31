import {
  normalizeJamCamItem as normalizeCanonicalJamCamItem,
  normalizeJamCamPayload,
  type CanonicalJamCamCameraRecord,
} from '../../src/shared/jamcamAdapter';

export type ProxyJamCamCameraRecord = CanonicalJamCamCameraRecord;

export function normalizeJamCamList(payload: unknown): ProxyJamCamCameraRecord[] {
  return normalizeJamCamPayload(payload);
}

export function normalizeJamCamItem(payload: unknown): ProxyJamCamCameraRecord | null {
  return normalizeCanonicalJamCamItem(payload);
}
