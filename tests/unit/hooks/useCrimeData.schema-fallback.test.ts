import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCrimeData } from '@/hooks/useCrimeData';
import * as policeApi from '@/services/policeApi';
import * as crimeCadence from '@/services/crimeCadence';
import { useAppStore } from '@/store/appStore';

vi.mock('@/services/policeApi', () => ({
  getCrimesInHolborn: vi.fn(),
  ALL_CRIME_CATEGORIES: ['burglary', 'violent-crime'],
}));

vi.mock('@/services/crimeCadence', () => ({
  resolveCrimePublicationCadence: vi.fn(),
}));

vi.mock('@/config/dataPolling', () => ({
  getCrimePollInterval: () => 60_000,
}));

describe('useCrimeData schema fallback contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ crimeSearchRadius: 1000 });
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: '2026-03',
      nextExpectedReleaseWindow: 'Late April 2026 to early May 2026',
      lagMonths: 2,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });
  });

  it('keeps last-known-good crime dataset when upstream payload drifts', async () => {
    vi.mocked(policeApi.getCrimesInHolborn)
      .mockResolvedValueOnce([
        {
          id: 'crime-1',
          category: 'violent-crime',
          location: { lat: 51.5185, lng: -0.1065 },
          street: { id: 's1', name: 'Hatton Garden' },
          month: '2026-03',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'crime-broken',
          category: 'invalid-category',
          location: { lat: 51.5185, lng: -0.1065 },
          street: { id: 's2', name: 'Broken payload' },
          month: '2026/03',
        },
      ] as unknown as ReturnType<typeof policeApi.getCrimesInHolborn> extends Promise<infer T> ? T : never);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.crimes[0].id).toBe('crime-1');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.crimes[0].id).toBe('crime-1');
    expect(result.current.isStale).toBe(true);
    expect(result.current.availability?.state).toBe('schema_drift');
    expect(result.current.error?.toLowerCase()).toContain('schema drift');
  });
});
