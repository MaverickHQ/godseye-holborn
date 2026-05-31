import { describe, expect, it } from 'vitest';
import {
  mapCameraFallbackErrorToStaleReason,
  mapSnapshotReasonToCameraStaleLabel,
} from '@/utils/cameraStaleReason';

describe('camera stale reason mapping', () => {
  it('maps snapshot freshness reasons to operator labels', () => {
    expect(mapSnapshotReasonToCameraStaleLabel('source_too_old')).toBe(
      'source snapshot age exceeded stale threshold',
    );
    expect(mapSnapshotReasonToCameraStaleLabel('stream_url_missing')).toBe(
      'snapshot URL missing from source',
    );
  });

  it('maps fallback error text to actionable stale reason', () => {
    expect(
      mapCameraFallbackErrorToStaleReason('Camera payload schema drift: no valid records'),
    ).toBe('camera payload schema drift fallback engaged');
    expect(mapCameraFallbackErrorToStaleReason('Unexpected timeout')).toBe(
      'camera polling failed - serving last-known-good snapshot state',
    );
  });
});

