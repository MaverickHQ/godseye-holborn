import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useCameraData contract', () => {
  const recentSnapshot = new Date().toISOString();

  const mockCameras: CameraSource[] = [
    {
      id: 'cam-1',
      name: 'Farringdon Rd/Cowcross St',
      type: 'traffic',
      provider: 'tfl',
      coordinates: { lat: 51.52, lng: -0.1059 },
      streamUrl: 'https://example.com/cam-1.jpg',
      status: 'active',
      lastVerified: recentSnapshot,
      feedType: 'snapshot',
    },
    {
      id: 'cam-2',
      name: 'Rosebery Av/Mount Pleasant',
      type: 'traffic',
      provider: 'tfl',
      coordinates: { lat: 51.5246, lng: -0.111 },
      streamUrl: 'https://example.com/cam-2.jpg',
      status: 'inactive',
      lastVerified: recentSnapshot,
      feedType: 'snapshot',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with loading=true and empty collections before fetch resolves', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue(mockCameras);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam.jpg',
      lastVerified: recentSnapshot,
    });

    const { result } = renderHook(() => useCameraData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.lastUpdated).toBe(null);
    expect(result.current.cameras).toEqual([]);
    expect(result.current.statuses).toEqual({});
    expect(result.current.selectedCamera).toBe(null);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('hydrates camera list, statuses, and aggregate count on successful fetch', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue(mockCameras);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam.jpg',
      lastVerified: recentSnapshot,
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameras).toHaveLength(2);
    expect(result.current.statuses).toEqual({
      'cam-1': 'snapshot',
      'cam-2': 'offline',
    });
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('preserves selected camera across successful refresh cycles', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue(mockCameras);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam.jpg',
      lastVerified: recentSnapshot,
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSelectedCamera(mockCameras[0]);
    });
    expect(result.current.selectedCamera?.id).toBe('cam-1');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.selectedCamera?.id).toBe('cam-1');
    expect(result.current.cameras).toHaveLength(2);
  });

  it('sets error when camera list fetch fails and clears it on a later success', async () => {
    vi.mocked(tflApi.getAllTrafficCameras)
      .mockRejectedValueOnce(new Error('TfL down'))
      .mockResolvedValueOnce(mockCameras);
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam.jpg',
      lastVerified: recentSnapshot,
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('TfL down');
    expect(result.current.cameras).toEqual([]);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(null);
    });

    expect(result.current.cameras).toHaveLength(2);
  });
});
