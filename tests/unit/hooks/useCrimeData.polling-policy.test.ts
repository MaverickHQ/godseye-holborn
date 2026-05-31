import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCrimeData } from '@/hooks/useCrimeData';
import * as policeApi from '@/services/policeApi';
import * as crimeCadence from '@/services/crimeCadence';
import { useAppStore } from '@/store/appStore';
import type { Crime } from '@/types';

vi.mock('@/services/policeApi', () => ({
  getCrimesInHolborn: vi.fn(),
  ALL_CRIME_CATEGORIES: ['violent-crime'],
}));

vi.mock('@/services/crimeCadence', () => ({
  resolveCrimePublicationCadence: vi.fn(),
}));

vi.mock('@/config/dataPolling', () => ({
  getCrimePollInterval: () => 60_000,
}));

describe('useCrimeData polling policy', () => {
  const crimesFixture: Crime[] = [
    {
      id: 'crime-1',
      category: 'violent-crime',
      location: { lat: 51.5185, lng: -0.1065 },
      street: { id: '1', name: 'Hatton Garden' },
      month: '2026-03',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    useAppStore.setState({ crimeSearchRadius: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enforces a publication-aware long refresh interval when latest month is already published', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(crimesFixture);
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: '2026-05',
      nextExpectedReleaseWindow: 'Late June 2026 to early July 2026',
      lagMonths: 0,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useCrimeData());

    await flushEffects();

    expect(result.current.refreshState.nextDelayMs).toBe(24 * 60 * 60 * 1000);
    expect(result.current.refreshState.circuitOpen).toBe(false);
  });

  it('applies failure backoff and recovers to cadence-aware baseline after success', async () => {
    vi.mocked(policeApi.getCrimesInHolborn)
      .mockRejectedValueOnce(new Error('Police UK unavailable'))
      .mockResolvedValueOnce(crimesFixture);
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: '2026-03',
      nextExpectedReleaseWindow: 'Late April 2026 to early May 2026',
      lagMonths: 2,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useCrimeData());

    await flushEffects();

    expect(policeApi.getCrimesInHolborn).toHaveBeenCalledTimes(1);
    expect(result.current.refreshState.consecutiveFailures).toBe(1);
    expect(result.current.refreshState.nextDelayMs).toBe(6 * 60 * 60 * 1000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    });
    await flushEffects();
    expect(policeApi.getCrimesInHolborn).toHaveBeenCalledTimes(2);

    expect(result.current.refreshState.consecutiveFailures).toBe(0);
    expect(result.current.refreshState.nextDelayMs).toBe(6 * 60 * 60 * 1000);
  });
});
  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }
