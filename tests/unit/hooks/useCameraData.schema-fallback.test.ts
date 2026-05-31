import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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

describe('useCameraData schema fallback contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
  });

  it('keeps last-known-good camera dataset when upstream payload drifts', async () => {
    vi.mocked(tflApi.getAllTrafficCameras)
      .mockResolvedValueOnce([
        {
          id: 'cam-1',
          name: 'Farringdon Rd/Cowcross St',
          type: 'traffic',
          provider: 'tfl',
          coordinates: { lat: 51.52, lng: -0.1059 },
          streamUrl: 'https://example.com/cam-1.jpg',
          status: 'active',
          lastVerified: new Date().toISOString(),
          feedType: 'snapshot',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cam-broken',
          name: 'Broken',
          type: 'traffic',
          provider: 'tfl',
          coordinates: { lat: Number.NaN, lng: -0.1060 },
          streamUrl: '',
          status: 'active',
          lastVerified: new Date().toISOString(),
          feedType: 'snapshot',
        },
      ] as unknown as ReturnType<typeof tflApi.getAllTrafficCameras> extends Promise<infer T> ? T : never);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam-valid.jpg',
      lastVerified: new Date().toISOString(),
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.cameras).toHaveLength(1);
    expect(result.current.cameras[0].id).toBe('cam-1');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.cameras).toHaveLength(1);
    expect(result.current.cameras[0].id).toBe('cam-1');
    expect(result.current.isStale).toBe(true);
    expect(result.current.staleReason?.toLowerCase()).toContain('schema');
    expect(result.current.error?.toLowerCase()).toContain('schema drift');
  });
});
