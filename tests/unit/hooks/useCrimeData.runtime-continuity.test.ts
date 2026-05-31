import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

const CACHE_KEY = 'godseye-crime-last-known-good-v1';

const cachedCrime: Crime = {
  id: 'cached-crime-1',
  category: 'violent-crime',
  location: { lat: 51.5185, lng: -0.1065 },
  street: { id: '1', name: 'Hatton Garden' },
  month: '2026-03',
};

describe('useCrimeData runtime continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({ crimeSearchRadius: 1000 });
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: null,
      nextExpectedReleaseWindow: 'Unavailable (source check failed)',
      lagMonths: null,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });
  });

  it('keeps showing cached last-known-good publication when current fetch has no rows', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        storedAt: '2026-05-28T09:00:00.000Z',
        publicationMonth: '2026-03',
        crimes: [cachedCrime],
      }),
    );
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue([]);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.crimes[0].id).toBe('cached-crime-1');
    expect(result.current.publicationCadence.dataCurrentThroughMonth).toBe('2026-03');
    expect(result.current.isStale).toBe(true);
    expect(result.current.availability?.state).toBe('no_publication');
    expect(result.current.error?.toLowerCase()).toContain('last-known-good');
  });

  it('derives publication month from returned crime payload when cadence endpoint is unavailable', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue([
      {
        id: 'crime-1',
        category: 'violent-crime',
        location: { lat: 51.5185, lng: -0.1065 },
        street: { id: 's1', name: 'Farringdon Road' },
        month: '2026-02',
      },
    ]);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.publicationCadence.dataCurrentThroughMonth).toBe('2026-02');
    expect(result.current.availability?.state).toBe('available');
    expect(result.current.crimes).toHaveLength(1);
  });

  it('classifies upstream fetch failures as source outage instead of no-publication', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockRejectedValue(new Error('Police API outage'));

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.crimes).toEqual([]);
    expect(result.current.availability?.state).toBe('source_outage');
    expect(result.current.error?.toLowerCase()).toContain('source outage');
    expect(result.current.error?.toLowerCase()).not.toContain('no published');
  });
});
