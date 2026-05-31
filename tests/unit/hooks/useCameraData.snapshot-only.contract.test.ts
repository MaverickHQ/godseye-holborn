import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraData } from '@/hooks/useCameraData';
import * as tflApi from '@/services/tflApi';
import { useAppStore } from '@/store/appStore';
import type { CameraSource } from '@/types';

vi.mock('@/services/tflApi', () => ({
  getAllTrafficCameras: vi.fn(),
  checkCameraStatus: vi.fn(),
  getCameraSnapshotMetadata: vi.fn(),
}));

vi.mock('@/config/dataPolling', () => ({
  getCameraPollInterval: () => 60000,
}));

describe('useCameraData snapshot-only contract', () => {
  const recentSnapshot = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
  });

  it('drops non-snapshot feeds and never emits live stream status labels', async () => {
    const mixedCameras = [
      {
        id: 'cam-snapshot',
        name: 'Snapshot Cam',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.52, lng: -0.1059 },
        streamUrl: 'https://example.com/snapshot.jpg',
        status: 'active',
        lastVerified: recentSnapshot,
        feedType: 'snapshot',
      },
      {
        id: 'cam-live',
        name: 'Legacy Live Cam',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.521, lng: -0.1061 },
        streamUrl: 'https://example.com/live.m3u8',
        status: 'active',
        lastVerified: recentSnapshot,
        feedType: 'live',
      } as unknown as CameraSource,
    ] as CameraSource[];

    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue(mixedCameras);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/snapshot.jpg',
      lastVerified: new Date().toISOString(),
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameras).toHaveLength(1);
    expect(result.current.cameras.map(camera => camera.id)).toEqual(['cam-snapshot']);
    expect(result.current.cameras.every(camera => camera.feedType === 'snapshot')).toBe(true);
    expect(Object.values(result.current.statuses)).not.toContain('live');
    expect(result.current.statuses['cam-snapshot']).toBe('snapshot');
    expect(result.current.statuses['cam-live']).toBeUndefined();
  });
});
