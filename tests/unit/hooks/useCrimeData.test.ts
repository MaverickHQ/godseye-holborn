import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCrimeData } from '@/hooks/useCrimeData';
import * as policeApi from '@/services/policeApi';
import * as crimeCadence from '@/services/crimeCadence';
import { useAppStore } from '@/store/appStore';
import type { Crime, CrimeCategory } from '@/types';

// Mock the police API
vi.mock('@/services/policeApi', () => ({
  getCrimesInHolborn: vi.fn(),
  ALL_CRIME_CATEGORIES: ['burglary', 'vehicle-crime', 'violent-crime'] as CrimeCategory[],
}));

// Mock polling config to avoid background poll races in contract tests
vi.mock('@/config/dataPolling', () => ({
  getCrimePollInterval: () => 60000,
}));

vi.mock('@/services/crimeCadence', () => ({
  resolveCrimePublicationCadence: vi.fn(),
}));

describe('useCrimeData', () => {
  const mockCrimes: Crime[] = [
    {
      id: '1',
      category: 'burglary',
      location: { lat: 51.5185, lng: -0.1065 },
      street: { id: 's1', name: 'High Street' },
      month: '2026-01',
    },
    {
      id: '2',
      category: 'vehicle-crime',
      location: { lat: 51.5185, lng: -0.1065 },
      street: { id: 's2', name: 'Main Road' },
      month: '2026-01',
    },
    {
      id: '3',
      category: 'violent-crime',
      location: { lat: 51.5185, lng: -0.1065 },
      street: { id: 's3', name: 'Side Street' },
      month: '2025-12',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({
      crimeSearchRadius: 1000,
    });
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: '2026-02',
      nextExpectedReleaseWindow: 'Late March 2026 to early April 2026',
      lagMonths: 2,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with loading=true and empty aggregates before first fetch resolves', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lastUpdated).toBe(null);
    expect(result.current.filteredCrimes).toEqual([]);
    expect(result.current.monthCounts).toEqual({});
    expect(result.current.selectedMonth).toBe(null);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('fetches crimes on mount and computes aggregate month counts', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    // Wait for the async fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(policeApi.getCrimesInHolborn).toHaveBeenCalledWith(3, 1000);
    expect(result.current.crimes).toHaveLength(3);
    expect(result.current.filteredCrimes).toHaveLength(3);
    expect(result.current.monthCounts).toEqual({
      '2026-01': 2,
      '2025-12': 1,
    });
    expect(result.current.publicationCadence.dataCurrentThroughMonth).toBe('2026-02');
    expect(result.current.publicationCadence.nextExpectedReleaseWindow).toContain('March 2026');
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('handles errors without mutating prior successful dataset', async () => {
    vi.mocked(policeApi.getCrimesInHolborn)
      .mockResolvedValueOnce(mockCrimes)
      .mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.crimes).toHaveLength(3);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.error).toContain('API Error');
    });

    expect(result.current.crimes).toHaveLength(3);
  });

  it('sets error and keeps empty aggregates when initial fetch fails', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Crime source outage: API Error');
    expect(result.current.availability?.state).toBe('source_outage');
    expect(result.current.crimes).toEqual([]);
    expect(result.current.filteredCrimes).toEqual([]);
    expect(result.current.monthCounts).toEqual({});
  });

  it('toggles category filters against filteredCrimes while preserving raw crimes', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.crimes).toHaveLength(3);
    expect(result.current.filteredCrimes).toHaveLength(3);

    act(() => {
      result.current.toggleFilter('burglary');
    });

    expect(result.current.crimes).toHaveLength(3);
    expect(result.current.filteredCrimes).toHaveLength(2);
    expect(result.current.filteredCrimes.map(crime => crime.category)).toEqual([
      'vehicle-crime',
      'violent-crime',
    ]);

    act(() => {
      result.current.toggleFilter('burglary');
    });

    expect(result.current.filteredCrimes).toHaveLength(3);
  });

  it('applies selectedMonth as a secondary filter', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSelectedMonth('2026-01');
    });

    expect(result.current.filteredCrimes).toHaveLength(2);
    expect(result.current.filteredCrimes.every(c => c.month === '2026-01')).toBe(true);
  });

  it('uses persisted crime radius setting for runtime fetches', async () => {
    useAppStore.setState({ crimeSearchRadius: 1500 });
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(policeApi.getCrimesInHolborn).toHaveBeenCalledWith(3, 1500);
  });

  it('refreshes data on manual refresh and clears prior errors on success', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue([
      ...mockCrimes,
      {
        id: '4',
        category: 'violent-crime' as CrimeCategory,
        location: { lat: 51.5185, lng: -0.1065 },
        street: { id: 's4', name: 'Hatton Garden' },
        month: '2026-02',
      },
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.crimes).toHaveLength(4);
    expect(result.current.monthCounts['2026-02']).toBe(1);
  });

  it('flags future-dated publication signals as a runtime anomaly', async () => {
    vi.mocked(policeApi.getCrimesInHolborn).mockResolvedValue([
      {
        id: 'future-crime',
        category: 'violent-crime',
        location: { lat: 51.5185, lng: -0.1065 },
        street: { id: 'sf', name: 'Future Lane' },
        month: '2099-01',
      },
    ]);
    vi.mocked(crimeCadence.resolveCrimePublicationCadence).mockResolvedValue({
      dataCurrentThroughMonth: '2099-01',
      nextExpectedReleaseWindow: 'Unavailable (source check pending)',
      lagMonths: 0,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.availability?.state).toBe('future_month');
    expect(result.current.isStale).toBe(true);
    expect(result.current.error?.toLowerCase()).toContain('future');
  });

  it('clears error on successful refresh after a failed initial fetch', async () => {
    // First call rejects, subsequent calls resolve
    vi.mocked(policeApi.getCrimesInHolborn)
      .mockRejectedValueOnce(new Error('Initial Error'))
      .mockResolvedValue(mockCrimes);

    const { result } = renderHook(() => useCrimeData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(null);
    });

    expect(result.current.filteredCrimes).toHaveLength(3);
  });
});
