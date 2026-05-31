import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraData } from '@/hooks/useCameraData';
import * as tflApi from '@/services/tflApi';
import { useAppStore } from '@/store/appStore';

vi.mock('@/services/tflApi', () => ({
  getAllTrafficCameras: vi.fn(),
  checkCameraStatus: vi.fn(),
  getCameraSnapshotMetadata: vi.fn(),
}));

vi.mock('@/config/dataPolling', () => ({
  getCameraPollInterval: () => 60_000,
}));

describe('useCameraData freshness contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
  });

  it('surfaces per-camera freshness states with explicit stale reasons', async () => {
    const now = Date.now();
    const freshTimestamp = new Date().toISOString();
    const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-fresh',
        name: 'Fresh Snapshot',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.52, lng: -0.1059 },
        streamUrl: 'https://example.com/fresh.jpg',
        status: 'active',
        lastVerified: freshTimestamp,
        feedType: 'snapshot',
      },
      {
        id: 'cam-old',
        name: 'Old Snapshot',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5201, lng: -0.106 },
        streamUrl: 'https://example.com/old.jpg',
        status: 'active',
        lastVerified: oldTimestamp,
        feedType: 'snapshot',
      },
      {
        id: 'cam-missing',
        name: 'Missing Timestamp',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5202, lng: -0.1061 },
        streamUrl: 'https://example.com/missing.jpg',
        status: 'active',
        lastVerified: '',
        feedType: 'snapshot',
      },
    ]);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async cameraId => ({
        status: 'active',
        imageUrl: 'https://example.com/cam.jpg',
        lastVerified:
          cameraId === 'cam-fresh'
            ? new Date(now - 90_000).toISOString()
            : new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameraFreshness['cam-fresh'].status).toBe('fresh');
    expect(result.current.cameraFreshness['cam-old'].status).toBe('stale');
    expect(result.current.cameraFreshness['cam-old'].reason).toBe('source_too_old');
    expect(result.current.cameraFreshness['cam-missing'].status).toBe('unavailable');
    expect(result.current.cameraFreshness['cam-missing'].reason).toBe('source_timestamp_missing');
    expect(result.current.statuses['cam-missing']).toBe('snapshot-aged');
  });
});
