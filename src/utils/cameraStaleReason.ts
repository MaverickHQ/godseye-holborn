import type { SnapshotFreshnessResult } from './snapshotFreshness';

export function mapSnapshotReasonToCameraStaleLabel(
  reason: SnapshotFreshnessResult['reason'],
): string {
  if (reason === 'fetch_failures') return 'camera snapshot polling failures';
  if (reason === 'source_too_old') return 'source snapshot age exceeded stale threshold';
  if (reason === 'clock_skew_exceeded') return 'source snapshot clock skew exceeded tolerance';
  if (reason === 'source_timestamp_missing') return 'source snapshot timestamp missing';
  if (reason === 'source_timestamp_invalid') return 'source snapshot timestamp invalid';
  if (reason === 'stream_url_missing') return 'snapshot URL missing from source';
  return 'unknown';
}

export function mapCameraFallbackErrorToStaleReason(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('schema drift')) return 'camera payload schema drift fallback engaged';
  if (lower.includes('invalid camera data payload')) return 'camera payload contract validation failed';
  return 'camera polling failed - serving last-known-good snapshot state';
}

