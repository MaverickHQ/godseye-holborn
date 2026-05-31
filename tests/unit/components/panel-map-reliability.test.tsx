import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/appStore';

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
  useMap: () => ({
    invalidateSize: vi.fn(),
    setView: vi.fn(),
  }),
  Marker: ({
    children,
    icon,
  }: {
    children?: React.ReactNode;
    icon?: { className?: string; html?: string };
  }) => {
    const className = icon?.className || '';
    if (className.includes('crime-cluster-marker')) {
      return (
        <div data-testid="marker-crime-cluster">
          <div dangerouslySetInnerHTML={{ __html: icon?.html ?? '' }} />
          {children}
        </div>
      );
    }
    if (className.includes('crime-marker')) {
      return <div data-testid="marker-crime">{children}</div>;
    }
    if (className.includes('camera-marker')) {
      return <div data-testid="marker-camera">{children}</div>;
    }
    return <div data-testid="marker-other">{children}</div>;
  },
}));

vi.mock('@/contexts/CrimeDataContext', () => ({
  useCrimeContext: vi.fn(),
}));

vi.mock('@/contexts/CameraDataContext', () => ({
  useCameraContext: vi.fn(),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useCameraContext } from '@/contexts/CameraDataContext';
import CityView from '@/components/city/CityView';
import CCTVGrid from '@/components/cctv/CCTVGrid';

const mockedUseCrimeContext = vi.mocked(useCrimeContext);
const mockedUseCameraContext = vi.mocked(useCameraContext);

describe('panel/map reliability contracts', () => {
  beforeEach(() => {
    useAppStore.setState({
      showHeatmap: false,
      selectedCrimeId: null,
      selectedCamera: null,
    });

    mockedUseCrimeContext.mockReturnValue({
      crimes: [
        {
          id: 'crime-1',
          category: 'violent-crime',
          location: { lat: 51.5181, lng: -0.1061 },
          street: { id: 1, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-2',
          category: 'other-theft',
          location: { lat: 51.51815, lng: -0.10612 },
          street: { id: 2, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-3',
          category: 'burglary',
          location: { lat: 51.5202, lng: -0.1088 },
          street: { id: 3, name: 'Farringdon Road' },
          month: '2026-01',
        },
      ],
      filteredCrimes: [
        {
          id: 'crime-1',
          category: 'violent-crime',
          location: { lat: 51.5181, lng: -0.1061 },
          street: { id: 1, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-2',
          category: 'other-theft',
          location: { lat: 51.51815, lng: -0.10612 },
          street: { id: 2, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-3',
          category: 'burglary',
          location: { lat: 51.5202, lng: -0.1088 },
          street: { id: 3, name: 'Farringdon Road' },
          month: '2026-01',
        },
      ],
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
      lastUpdated: new Date('2026-05-24T10:12:00Z'),
      refreshState: {
        source: 'crime',
        consecutiveFailures: 0,
        circuitOpen: false,
        nextDelayMs: 6 * 60 * 60 * 1000,
        nextAttemptAt: new Date('2026-05-24T16:12:00Z'),
      },
      monthCounts: { '2026-02': 2, '2026-01': 1 },
      selectedMonth: null,
      setSelectedMonth: vi.fn(),
      toggleFilter: vi.fn(),
      refresh: vi.fn(async () => undefined),
    });

    mockedUseCameraContext.mockReturnValue({
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
    });
  });

  it('uses pin markers by default and clustered bubbles in heat mode', () => {
    const location = {
      name: 'Holborn',
      address: '52 Holborn Viaduct',
      lat: 51.5185,
      lng: -0.1065,
    };

    const { rerender } = render(<CityView targetLocation={location} />);
    expect(screen.getAllByTestId('marker-crime')).toHaveLength(3);

    act(() => {
      useAppStore.setState({ showHeatmap: true });
    });
    rerender(<CityView targetLocation={location} />);

    expect(screen.getAllByTestId('marker-crime-cluster').length).toBeLessThan(3);
  });

  it('clears orphaned selected crime id when filtered set no longer contains it', () => {
    useAppStore.setState({ selectedCrimeId: 'crime-orphaned' });

    render(
      <CityView
        targetLocation={{
          name: 'Holborn',
          address: '52 Holborn Viaduct',
          lat: 51.5185,
          lng: -0.1065,
        }}
      />,
    );

    expect(useAppStore.getState().selectedCrimeId).toBeNull();
  });

  it('renders deterministic empty/error states for CCTV panel', () => {
    mockedUseCameraContext.mockReturnValue({
      cameras: [],
      statuses: {},
      cameraFreshness: {},
      isLoading: false,
      isStale: false,
      error: 'Upstream unavailable',
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
    });

    render(<CCTVGrid standalone />);
    expect(screen.getByText(/upstream unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/no cameras currently available/i)).toBeInTheDocument();
  });
});
