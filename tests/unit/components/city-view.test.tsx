import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CityView from '@/components/city/CityView';
import { useAppStore } from '@/store/appStore';

const mapCalls: string[] = [];
const mapMock = {
  invalidateSize: vi.fn(() => {
    mapCalls.push('invalidateSize');
  }),
  setView: vi.fn(() => {
    mapCalls.push('setView');
  }),
};

let lastZoomControl: unknown = null;
let lastTileUrl = '';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
  divIcon: vi.fn(() => ({})),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, zoomControl }: { children: React.ReactNode; zoomControl: unknown }) => {
    lastZoomControl = zoomControl;
    return <div data-testid="map-container">{children}</div>;
  },
  TileLayer: ({ url }: { url: string }) => {
    lastTileUrl = url;
    return <div data-testid="tile-layer" />;
  },
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => mapMock,
}));

vi.mock('@/contexts/CrimeDataContext', () => ({
  useCrimeContext: () => ({
    crimes: [],
    filteredCrimes: [],
    filters: [],
    isLoading: false,
    isStale: false,
    error: null,
    lastUpdated: null,
    monthCounts: {},
    selectedMonth: null,
    setSelectedMonth: vi.fn(),
    toggleFilter: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/contexts/CameraDataContext', () => ({
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

describe('CityView recovery behaviors', () => {
  afterEach(() => {
    mapCalls.length = 0;
    mapMock.invalidateSize.mockClear();
    mapMock.setView.mockClear();
    lastZoomControl = null;
    lastTileUrl = '';
  });

  it('disables default zoom controls for the map container', () => {
    render(
      <CityView
        targetLocation={{
          name: 'Holborn',
          address: '52 Holborn Viaduct',
          lat: 51.5185,
          lng: -0.1065,
        }}
      />
    );

    expect(lastZoomControl).toBe(false);
  });

  it('invalidates map size before setting view on mount', () => {
    render(
      <CityView
        targetLocation={{
          name: 'Holborn',
          address: '52 Holborn Viaduct',
          lat: 51.5185,
          lng: -0.1065,
        }}
      />
    );

    expect(mapCalls.slice(0, 2)).toEqual(['invalidateSize', 'setView']);
  });

  it('switches map tile provider based on persisted map style setting', () => {
    act(() => {
      useAppStore.setState({ mapTileStyle: 'dark' });
    });
    const location = {
      name: 'Holborn',
      address: '52 Holborn Viaduct',
      lat: 51.5185,
      lng: -0.1065,
    };

    const { rerender } = render(<CityView targetLocation={location} />);
    expect(lastTileUrl).toContain('dark_all');

    act(() => {
      useAppStore.setState({ mapTileStyle: 'street' });
    });
    rerender(<CityView targetLocation={location} />);
    expect(lastTileUrl).toContain('openstreetmap.org');
  });

  it('removes deprecated floating live monitoring mini-panel from map canvas', () => {
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

    expect(screen.queryByText(/live monitoring/i)).not.toBeInTheDocument();
  });
});
