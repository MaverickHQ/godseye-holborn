import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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
  getCameraPollInterval: () => 60_000,
}));

describe('useCameraData polling policy', () => {
  const cameraFixture: CameraSource[] = [
    {
      id: 'cam-1',
      name: 'Farringdon Snapshot',
      type: 'traffic',
      provider: 'tfl',
      coordinates: { lat: 51.52, lng: -0.1059 },
      streamUrl: 'https://example.com/cam-1.jpg',
      status: 'active',
      lastVerified: new Date().toISOString(),
      feedType: 'snapshot',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useAppStore.setState({ cameraRefreshInterval: 60_000 });
    vi.mocked(tflApi.getCameraSnapshotMetadata as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'active',
      imageUrl: 'https://example.com/cam.jpg',
      lastVerified: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('applies rate-limit-safe retry budget before issuing another camera poll', async () => {
    vi.mocked(tflApi.getAllTrafficCameras)
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: { 'retry-after': '120' },
        },
      })
      .mockResolvedValueOnce(cameraFixture);

    const { result } = renderHook(() => useCameraData());

    await flushEffects();

    expect(tflApi.getAllTrafficCameras).toHaveBeenCalledTimes(1);
    expect(result.current.refreshState.nextDelayMs).toBe(240_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    await flushEffects();
    expect(tflApi.getAllTrafficCameras).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    await flushEffects();
    expect(tflApi.getAllTrafficCameras).toHaveBeenCalledTimes(2);

    expect(result.current.refreshState.consecutiveFailures).toBe(0);
    expect(result.current.refreshState.nextDelayMs).toBe(60_000);
  });

  it('opens circuit-breaker style cooldown after repeated polling failures', async () => {
    vi.mocked(tflApi.getAllTrafficCameras).mockRejectedValue(new Error('TfL unavailable'));

    const { result } = renderHook(() => useCameraData());

    await flushEffects();
    expect(result.current.refreshState.consecutiveFailures).toBe(1);
    expect(result.current.refreshState.nextDelayMs).toBe(60_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flushEffects();
    expect(tflApi.getAllTrafficCameras).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    await flushEffects();
    expect(tflApi.getAllTrafficCameras).toHaveBeenCalledTimes(3);

    expect(result.current.refreshState.circuitOpen).toBe(true);
    expect(result.current.refreshState.consecutiveFailures).toBe(3);
    expect(result.current.refreshState.nextDelayMs).toBe(180_000);
  });

  it('uses persisted camera refresh interval as polling baseline', async () => {
    useAppStore.setState({ cameraRefreshInterval: 120_000 });
    vi.mocked(tflApi.getAllTrafficCameras).mockResolvedValue(cameraFixture);

    const { result } = renderHook(() => useCameraData());
    await flushEffects();

    expect(result.current.refreshState.nextDelayMs).toBe(120_000);
    expect(result.current.refreshState.consecutiveFailures).toBe(0);
  });
});
  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }
