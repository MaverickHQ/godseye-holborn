import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/appStore';

let isMobile = false;

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => isMobile,
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

vi.mock('@/components/layout/LeftPanel', () => {
  function MockLeftPanel() {
    const store = useAppStore();
    return (
      <button onClick={() => store.setSelectedCrimeId('crime-link-1')} aria-label="Select crime">
        Select crime from panel
      </button>
    );
  }

  return { default: MockLeftPanel };
});

vi.mock('@/components/city/CityView', () => {
  function MockCityView() {
    const selectedCrimeId = useAppStore(state => state.selectedCrimeId);
    return <div data-testid="map-selected-crime">{selectedCrimeId ?? 'none'}</div>;
  }

  return { default: MockCityView };
});

vi.mock('@/components/cctv/CCTVGrid', () => {
  function MockCCTVGrid() {
    const setSelectedCamera = useAppStore(state => state.setSelectedCamera);
    return (
      <button
        onClick={() =>
          setSelectedCamera({
            id: 'cam-mobile-1',
            name: 'Mobile Camera',
            type: 'traffic',
            provider: 'tfl',
            coordinates: { lat: 51.52, lng: -0.106 },
            streamUrl: 'https://example.com/mobile-cam.jpg',
            status: 'active',
            lastVerified: '2026-05-23T18:00:00Z',
            feedType: 'snapshot',
          })
        }
      >
        Open mobile camera
      </button>
    );
  }

  return { default: MockCCTVGrid };
});

vi.mock('@/components/layout/MobileBottomNav', () => ({
  default: ({ onSectionChange }: { onSectionChange: (section: 'map' | 'crime' | 'cctv' | 'settings') => void }) => (
    <button onClick={() => onSectionChange('cctv')}>Go CCTV</button>
  ),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: ({ camera }: { camera: { name: string } }) => <div data-testid="video-player">{camera.name}</div>,
}));

import App from '@/components/core/App';

describe('screenshot interaction recovery', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedCamera: null,
      selectedCrimeId: null,
    });
  });

  it('links panel selection to map-selected crime state', () => {
    isMobile = false;
    render(<App />);

    expect(screen.getByTestId('map-selected-crime')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: /select crime/i }));

    expect(screen.getByTestId('map-selected-crime')).toHaveTextContent('crime-link-1');
    expect(useAppStore.getState().selectedCrimeId).toBe('crime-link-1');
  });

  it('opens and closes fullscreen camera modal on mobile overlay flow', async () => {
    isMobile = true;
    render(<App />);

    fireEvent.click(screen.getByText('Go CCTV'));
    fireEvent.click(screen.getByText('Open mobile camera'));

    expect(screen.getByRole('button', { name: /close camera/i })).toBeInTheDocument();
    expect(await screen.findByTestId('video-player')).toHaveTextContent('Mobile Camera');

    fireEvent.click(screen.getByRole('button', { name: /close camera/i }));
    expect(useAppStore.getState().selectedCamera).toBeNull();
  });
});
