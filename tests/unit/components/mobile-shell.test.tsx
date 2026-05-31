import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/appStore';

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/contexts/CrimeDataContext', () => ({
  CrimeDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCrimeContext: () => ({
    crimes: [],
    filters: [],
    isLoading: false,
    isStale: false,
    error: null,
    publicationCadence: {
      dataCurrentThroughMonth: '2026-03',
      nextExpectedReleaseWindow: 'Late April 2026',
      sourceLagCaveat: 'Police UK publishes monthly data with source lag.',
    },
    lastUpdated: null,
    refreshState: {
      source: 'crime',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 6 * 60 * 60 * 1000,
      nextAttemptAt: null,
    },
    filteredCrimes: [],
    monthCounts: {},
    selectedMonth: null,
    setSelectedMonth: vi.fn(),
    toggleFilter: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/contexts/CameraDataContext', () => ({
  CameraDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCameraContext: () => ({
    cameras: [],
    statuses: {},
    isLoading: false,
    isStale: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/layout/LeftPanel', () => ({
  default: () => <div data-testid="left-panel" />,
}));

vi.mock('@/components/city/CityView', () => ({
  default: () => <div data-testid="city-view" />,
}));

vi.mock('@/components/cctv/CCTVGrid', () => ({
  default: () => <div data-testid="cctv-grid" />,
}));

vi.mock('@/components/layout/MobileBottomNav', () => ({
  default: () => <div data-testid="mobile-bottom-nav" />,
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: ({ camera }: { camera: { name: string } }) => (
    <div data-testid="video-player">{camera.name}</div>
  ),
}));

import App from '@/components/core/App';

describe('Recovery UI behaviors', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedCamera: null,
      selectedCrimeId: null,
      mapTileStyle: 'dark',
      crimeSearchRadius: 1000,
      cameraRefreshInterval: 60000,
      locations: [
        {
          id: 'the-fable',
          name: 'Holborn',
          address: '52 Holborn Viaduct',
          lat: 51.5185,
          lng: -0.1065,
          altitude: 30,
        },
      ],
      activeLocationId: 'the-fable',
    });
  });

  it('opens the settings panel from the header on mobile', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(await screen.findByText('Map Style')).toBeInTheDocument();
    expect(await screen.findByText('Data Sources')).toBeInTheDocument();
  });

  it('opens a fullscreen camera modal on mobile when a camera is selected', async () => {
    useAppStore.setState({
      selectedCamera: {
        id: 'cam-1',
        name: 'Recovery Camera',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5185, lng: -0.1065 },
        streamUrl: 'https://example.com/cam.jpg',
        status: 'active',
        lastVerified: '2026-05-23T12:00:00Z',
        feedType: 'snapshot',
      },
    });

    render(<App />);

    expect(screen.getAllByText('Recovery Camera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /close camera/i })).toBeInTheDocument();
    expect(await screen.findByTestId('video-player')).toBeInTheDocument();
  });
});
