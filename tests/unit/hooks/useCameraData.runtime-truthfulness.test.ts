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

describe('useCameraData snapshot truthfulness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
  });

  it('keeps snapshot statuses truthful when upstream status checks are unknown', async () => {
    const now = Date.now();
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-fresh',
        name: 'Fresh Snapshot',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5200, lng: -0.1059 },
        streamUrl: 'https://example.com/fresh.jpg',
        status: 'active',
        lastVerified: new Date(now - 60_000).toISOString(),
        feedType: 'snapshot',
      },
      {
        id: 'cam-aging',
        name: 'Aging Snapshot',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5201, lng: -0.1060 },
        streamUrl: 'https://example.com/aging.jpg',
        status: 'active',
        lastVerified: new Date(now - 12 * 60_000).toISOString(),
        feedType: 'snapshot',
      },
    ]);
    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameraFreshness['cam-fresh'].status).toBe('fresh');
    expect(result.current.cameraFreshness['cam-aging'].status).toBe('aging');

    expect(result.current.statuses['cam-fresh']).toBe('snapshot');
    expect(result.current.statuses['cam-aging']).toBe('snapshot-aged');
    expect(result.current.isStale).toBe(false);
  });

  it('uses sourceCheckedAt heartbeat so old capture timestamps do not force false stale/offline states', async () => {
    const now = Date.now();
    const oldCaptureTimestamp = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const freshSourceCheckTimestamp = new Date(now - 30_000).toISOString();

    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-old-capture-fresh-check',
        name: 'Old capture, fresh source check',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5203, lng: -0.1061 },
        streamUrl: 'https://example.com/old-capture.jpg',
        status: 'active',
        lastVerified: oldCaptureTimestamp,
        sourceCheckedAt: freshSourceCheckTimestamp,
        feedType: 'snapshot',
      },
    ]);

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.statuses['cam-old-capture-fresh-check']).toBe('snapshot');
    expect(result.current.cameraFreshness['cam-old-capture-fresh-check'].status).toBe('fresh');
    expect(result.current.cameraFreshness['cam-old-capture-fresh-check'].sourceTimestamp).toBe(
      freshSourceCheckTimestamp,
    );
    expect(result.current.isStale).toBe(false);
  });

  it('avoids per-camera metadata fan-out when list payload already has snapshot timestamps', async () => {
    const now = Date.now();
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-a',
        name: 'Snapshot A',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5200, lng: -0.1059 },
        streamUrl: 'https://example.com/a.jpg',
        status: 'active',
        lastVerified: new Date(now - 60_000).toISOString(),
        feedType: 'snapshot',
      },
      {
        id: 'cam-b',
        name: 'Snapshot B',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5201, lng: -0.1060 },
        streamUrl: 'https://example.com/b.jpg',
        status: 'active',
        lastVerified: new Date(now - 120_000).toISOString(),
        feedType: 'snapshot',
      },
    ]);

    const metadataSpy = vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>);
    metadataSpy.mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/a.jpg',
      lastVerified: new Date(now - 60_000).toISOString(),
    });

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(metadataSpy).not.toHaveBeenCalled();
    expect(result.current.statuses['cam-a']).toBe('snapshot');
    expect(result.current.statuses['cam-b']).toBe('snapshot');
  });

  it('uses list payload timestamp provenance when camera rows include lastVerified', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-source-header',
        name: 'List Timestamp Camera',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5200, lng: -0.1059 },
        streamUrl: 'https://example.com/fresh.jpg',
        status: 'active',
        lastVerified: '2026-05-28T07:26:34.000Z',
        feedType: 'snapshot',
      },
    ]);

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameraFreshness['cam-source-header'].sourceTimestamp).toBe(
      '2026-05-28T07:26:34.000Z',
    );
  });

  it('does not mark snapshot stale when source timestamp is present but heartbeat status is unknown', async () => {
    const freshSourceTimestamp = new Date(Date.now() - 30_000).toISOString();
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-stable-source',
        name: 'Stable source timestamp',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5202, lng: -0.1062 },
        streamUrl: 'https://example.com/stable.jpg',
        status: 'active',
        lastVerified: freshSourceTimestamp,
        feedType: 'snapshot',
      },
    ]);

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
      await result.current.refresh();
    });

    expect(result.current.statuses['cam-stable-source']).toBe('snapshot');
    expect(result.current.cameraFreshness['cam-stable-source'].status).toBe('fresh');
    expect(result.current.isStale).toBe(false);
  });

  it('keeps snapshot feed online in degraded mode when source timestamp is missing but snapshot URL exists', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue([
      {
        id: 'cam-missing-ts',
        name: 'Missing timestamp snapshot',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5202, lng: -0.1062 },
        streamUrl: 'https://example.com/missing-ts.jpg',
        status: 'active',
        lastVerified: '',
        feedType: 'snapshot',
      },
    ]);

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cameraFreshness['cam-missing-ts'].reason).toBe('source_timestamp_missing');
    expect(result.current.statuses['cam-missing-ts']).toBe('snapshot-aged');
    expect(result.current.isStale).toBe(false);
  });

  it('retains freshest known snapshot timestamp when stale list timestamps reappear', async () => {
    const now = Date.now();
    const staleListTimestamp = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const freshListTimestamp = new Date(now - 45_000).toISOString();

    vi.mocked(tflApi.getAllTrafficCameras)
      .mockResolvedValueOnce([
        {
          id: 'cam-stale-list',
          name: 'Stale list timestamp camera',
          type: 'traffic',
          provider: 'tfl',
          coordinates: { lat: 51.5205, lng: -0.1058 },
          streamUrl: 'https://example.com/stale-list.jpg',
          status: 'active',
          lastVerified: freshListTimestamp,
          feedType: 'snapshot',
        },
      ])
      .mockResolvedValueOnce([
      {
        id: 'cam-stale-list',
        name: 'Stale list timestamp camera',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5205, lng: -0.1058 },
        streamUrl: 'https://example.com/stale-list.jpg',
        status: 'active',
        lastVerified: staleListTimestamp,
        feedType: 'snapshot',
      },
    ]);

    const { result } = renderHook(() => useCameraData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.statuses['cam-stale-list']).toBe('snapshot');
    expect(result.current.cameraFreshness['cam-stale-list'].sourceTimestamp).toBe(freshListTimestamp);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.statuses['cam-stale-list']).toBe('snapshot');
    expect(result.current.cameraFreshness['cam-stale-list'].sourceTimestamp).toBe(freshListTimestamp);
    expect(result.current.isStale).toBe(false);
  });
});
