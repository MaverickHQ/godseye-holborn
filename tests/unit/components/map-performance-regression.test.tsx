import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const invalidateSizeSpy = vi.fn();
const setViewSpy = vi.fn();
const mapInstance = {
  invalidateSize: invalidateSizeSpy,
  setView: setViewSpy,
};

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((options: Record<string, unknown>) => options),
  },
  divIcon: vi.fn((options: Record<string, unknown>) => options),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useMap: () => mapInstance,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
      dataCurrentThroughMonth: '2026-02',
      nextExpectedReleaseWindow: 'Late March 2026 to early April 2026',
      lagMonths: 2,
      sourceLagCaveat:
        'Police UK street-level crime data is published monthly and may lag by several weeks.',
      checkedAt: new Date().toISOString(),
    },
    lastUpdated: null,
    monthCounts: {},
    selectedMonth: null,
    setSelectedMonth: vi.fn(),
    toggleFilter: vi.fn(),
    refresh: vi.fn(async () => undefined),
  }),
}));

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
    refresh: vi.fn(async () => undefined),
  }),
}));

import CityView from '@/components/city/CityView';

describe('map performance regression contract', () => {
  beforeEach(() => {
    invalidateSizeSpy.mockClear();
    setViewSpy.mockClear();
  });

  it('does not recenter the map on rerenders with unchanged location', () => {
    const location = {
      name: 'Holborn',
      address: '52 Holborn Viaduct',
      lat: 51.5185,
      lng: -0.1065,
    };

    const { rerender } = render(<CityView targetLocation={location} />);
    expect(setViewSpy).toHaveBeenCalledTimes(1);

    rerender(<CityView targetLocation={location} />);
    expect(setViewSpy).toHaveBeenCalledTimes(1);
  });

  it('recenters map when location coordinates actually change', () => {
    const { rerender } = render(
      <CityView
        targetLocation={{
          name: 'Holborn',
          address: '52 Holborn Viaduct',
          lat: 51.5185,
          lng: -0.1065,
        }}
      />,
    );
    expect(setViewSpy).toHaveBeenCalledTimes(1);

    rerender(
      <CityView
        targetLocation={{
          name: 'Holborn Drift',
          address: '54 Holborn Viaduct',
          lat: 51.519,
          lng: -0.105,
        }}
      />,
    );

    expect(setViewSpy).toHaveBeenCalledTimes(2);
  });
});
