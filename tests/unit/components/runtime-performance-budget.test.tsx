import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import LeftPanel from '@/components/layout/LeftPanel';
import { buildCrimeClusters } from '@/components/city/crimeClusters';
import PERFORMANCE_BUDGETS from '@/config/performanceBudgets';
import type { Crime } from '@/types';

vi.mock('@/store/appStore', async () => {
  const actual = await vi.importActual<typeof import('@/store/appStore')>('@/store/appStore');
  return {
    ...actual,
    useActiveLocation: () => ({
      name: 'Holborn',
      address: '52 Holborn Viaduct',
      lat: 51.5185,
      lng: -0.1065,
    }),
  };
});

vi.mock('@/contexts/CameraDataContext', () => ({
  useCameraContext: () => ({
    cameras: [],
    statuses: {},
    cameraFreshness: {},
    isLoading: false,
    isStale: false,
    error: null,
    staleReason: null,
    lastUpdated: null,
    refreshState: {
      source: 'camera',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 60_000,
      nextAttemptAt: null,
    },
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock('@/contexts/CrimeDataContext', () => ({
  useCrimeContext: () => ({
    crimes: [],
    filteredCrimes: [],
    filters: [],
    isLoading: false,
    isStale: false,
    error: null,
    publicationCadence: {
      dataCurrentThroughMonth: '2026-03',
      nextExpectedReleaseWindow: 'Late April 2026 to early May 2026',
      lagMonths: 2,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    },
    lastUpdated: null,
    refreshState: {
      source: 'crime',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 6 * 60 * 60 * 1000,
      nextAttemptAt: null,
    },
    monthCounts: {},
    selectedMonth: null,
    setSelectedMonth: vi.fn(),
    toggleFilter: vi.fn(),
    refresh: vi.fn(async () => undefined),
  }),
}));

describe('runtime performance budgets', () => {
  it('renders left panel within deterministic budget on baseline fixture', () => {
    const start = performance.now();
    render(<LeftPanel />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThanOrEqual(PERFORMANCE_BUDGETS.runtime.maxLeftPanelRenderMs);
  });

  it('builds crime clusters under fixture budget threshold', () => {
    const crimes: Crime[] = Array.from({ length: PERFORMANCE_BUDGETS.runtime.clusterFixtureCount }).map(
      (_, index) => ({
        id: `crime-${index}`,
        category: index % 3 === 0 ? 'violent-crime' : index % 3 === 1 ? 'other-theft' : 'burglary',
        month: index % 2 === 0 ? '2026-03' : '2026-02',
        location: {
          lat: 51.50 + ((index % 40) * 0.0007),
          lng: -0.13 + ((index % 55) * 0.0006),
        },
        street: {
          id: index,
          name: `Street ${index}`,
        },
      }),
    );

    const start = performance.now();
    const clusters = buildCrimeClusters(crimes);
    const duration = performance.now() - start;

    expect(clusters.length).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(PERFORMANCE_BUDGETS.runtime.maxClusterBuildMs);
  });
});
