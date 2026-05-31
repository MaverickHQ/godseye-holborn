import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useCrimeData', () => ({
  useCrimeData: vi.fn(),
}));

vi.mock('@/hooks/useCameraData', () => ({
  useCameraData: vi.fn(),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

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

    if (className.includes('camera-marker')) {
      return <div data-testid="marker-camera">{children}</div>;
    }

    if (className.includes('crime-marker')) {
      return <div data-testid="marker-crime">{children}</div>;
    }

    if (className.includes('target-marker')) {
      return <div data-testid="marker-target">{children}</div>;
    }

    return <div data-testid="marker-unknown">{children}</div>;
  },
}));

import { useCrimeData } from '@/hooks/useCrimeData';
import { useCameraData } from '@/hooks/useCameraData';
import { useAppStore } from '@/store/appStore';
import App from '@/components/core/App';

const mockedUseCrimeData = vi.mocked(useCrimeData);
const mockedUseCameraData = vi.mocked(useCameraData);

describe('unified dataflow contract', () => {
  beforeEach(() => {
    const recentSnapshot = new Date().toISOString();

    useAppStore.setState({
      selectedCamera: null,
      selectedCrimeId: null,
      showHeatmap: false,
      notifications: [],
      unreadCount: 0,
    });

    mockedUseCameraData.mockReturnValue({
      cameras: [
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
          status: 'active',
          lastVerified: recentSnapshot,
          feedType: 'snapshot',
        },
      ],
      statuses: {
        'cam-1': 'snapshot',
        'cam-2': 'offline',
      },
      cameraFreshness: {},
      isLoading: false,
      isStale: false,
      error: null,
      staleReason: null,
      lastUpdated: new Date('2026-04-24T21:25:00Z'),
      selectedCamera: null,
      setSelectedCamera: vi.fn(),
      refreshState: {
        source: 'camera',
        consecutiveFailures: 0,
        circuitOpen: false,
        nextDelayMs: 60_000,
        nextAttemptAt: new Date('2026-04-24T21:26:00Z'),
      },
      refresh: vi.fn(async () => undefined),
    });

    mockedUseCrimeData.mockReturnValue({
      crimes: [
        {
          id: 'crime-1',
          category: 'violent-crime',
          location: { lat: 51.518, lng: -0.106 },
          street: { id: 1, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-2',
          category: 'other-theft',
          location: { lat: 51.519, lng: -0.108 },
          street: { id: 2, name: 'Farringdon Road' },
          month: '2026-02',
        },
        {
          id: 'crime-3',
          category: 'burglary',
          location: { lat: 51.516, lng: -0.107 },
          street: { id: 3, name: 'Brooke Street' },
          month: '2026-01',
        },
      ],
      filters: [
        { category: 'violent-crime', enabled: true },
        { category: 'other-theft', enabled: true },
        { category: 'burglary', enabled: false },
      ],
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
      lastUpdated: new Date('2026-04-24T21:26:00Z'),
      refreshState: {
        source: 'crime',
        consecutiveFailures: 0,
        circuitOpen: false,
        nextDelayMs: 6 * 60 * 60 * 1000,
        nextAttemptAt: new Date('2026-04-25T03:26:00Z'),
      },
      filteredCrimes: [
        {
          id: 'crime-1',
          category: 'violent-crime',
          location: { lat: 51.518, lng: -0.106 },
          street: { id: 1, name: 'Hatton Garden' },
          month: '2026-02',
        },
        {
          id: 'crime-2',
          category: 'other-theft',
          location: { lat: 51.519, lng: -0.108 },
          street: { id: 2, name: 'Farringdon Road' },
          month: '2026-02',
        },
      ],
      monthCounts: { '2026-02': 2, '2026-01': 1 },
      selectedMonth: null,
      setSelectedMonth: vi.fn(),
      toggleFilter: vi.fn(),
      refresh: vi.fn(async () => undefined),
    });
  });

  it('drives map markers and panel counts from the same context datasets', () => {
    render(<App />);

    expect(screen.getByText(/2 cameras in range/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('marker-camera')).toHaveLength(2);
    expect(screen.getAllByTestId('marker-crime')).toHaveLength(2);
    expect(screen.getAllByTestId('marker-target')).toHaveLength(1);

    const incidentsHeader = screen.getByText(/crime incidents/i).closest('div');
    expect(incidentsHeader).not.toBeNull();
    expect(incidentsHeader?.textContent).toContain('2');
  });
});
