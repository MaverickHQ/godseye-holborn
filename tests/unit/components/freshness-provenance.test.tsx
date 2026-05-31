import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useCrimeData', () => ({
  useCrimeData: vi.fn(),
}));

vi.mock('@/hooks/useCameraData', () => ({
  useCameraData: vi.fn(),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

import { useCrimeData } from '@/hooks/useCrimeData';
import { useCameraData } from '@/hooks/useCameraData';
import { CrimeDataProvider } from '@/contexts/CrimeDataContext';
import { CameraDataProvider } from '@/contexts/CameraDataContext';
import LeftPanel from '@/components/layout/LeftPanel';
import CCTVGrid from '@/components/cctv/CCTVGrid';

const mockedUseCrimeData = vi.mocked(useCrimeData);
const mockedUseCameraData = vi.mocked(useCameraData);

describe('freshness and provenance UI contracts', () => {
  const crimeBaseline: ReturnType<typeof useCrimeData> = {
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
        month: '2026-01',
      },
    ],
    filters: [
      { category: 'violent-crime', enabled: true },
      { category: 'other-theft', enabled: true },
    ],
    isLoading: false,
    isStale: false,
    error: null,
    availability: {
      state: 'available',
      message: 'Crime source healthy',
    },
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
        month: '2026-01',
      },
    ],
    monthCounts: { '2026-02': 1, '2026-01': 1 },
    selectedMonth: null,
    setSelectedMonth: vi.fn(),
    toggleFilter: vi.fn(),
    refresh: vi.fn(async () => undefined),
  };

  const cameraBaseline: ReturnType<typeof useCameraData> = {
    cameras: [
      {
        id: 'cam-1',
        name: 'Farringdon Rd/Cowcross St',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.52, lng: -0.1059 },
        streamUrl: 'https://example.com/cam-1.jpg',
        status: 'active',
        lastVerified: '2026-05-24T10:10:00Z',
        feedType: 'snapshot',
      },
    ],
    statuses: { 'cam-1': 'snapshot' },
    cameraFreshness: {},
    isLoading: false,
    isStale: false,
    error: null,
    staleReason: null,
    lastUpdated: new Date('2026-05-24T10:11:00Z'),
    selectedCamera: null,
    setSelectedCamera: vi.fn(),
    refreshState: {
      source: 'camera',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 60_000,
      nextAttemptAt: new Date('2026-05-24T10:12:00Z'),
    },
    refresh: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    mockedUseCrimeData.mockReturnValue(crimeBaseline);
    mockedUseCameraData.mockReturnValue(cameraBaseline);
  });

  it('renders explicit source attribution and separate freshness semantics', () => {
    render(
      <CrimeDataProvider>
        <CameraDataProvider>
          <div>
            <LeftPanel />
            <CCTVGrid standalone />
          </div>
        </CameraDataProvider>
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/^crime source:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/police uk/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/data current through/i)).toBeInTheDocument();
    expect(screen.getByText(/february 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/next expected release window/i)).toBeInTheDocument();

    expect(screen.getByText(/camera source/i)).toBeInTheDocument();
    expect(screen.getByText(/tfl jamcam snapshots/i)).toBeInTheDocument();
    expect(screen.getByText(/snapshot updated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/source: tfl/i).length).toBeGreaterThan(0);
  });

  it('renders stale-state warnings for camera and crime datasets independently', () => {
    mockedUseCrimeData.mockReturnValue({
      ...crimeBaseline,
      isStale: true,
    });
    mockedUseCameraData.mockReturnValue({
      ...cameraBaseline,
      isStale: true,
    });

    render(
      <CrimeDataProvider>
        <CameraDataProvider>
          <div>
            <LeftPanel />
            <CCTVGrid standalone />
          </div>
        </CameraDataProvider>
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/crime data stale/i)).toBeInTheDocument();
    expect(screen.getAllByText(/camera snapshot stale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/last known snapshot retained/i).length).toBeGreaterThan(0);
  });

  it('shows source-unavailable semantics instead of no-publication during outages', () => {
    mockedUseCrimeData.mockReturnValue({
      ...crimeBaseline,
      crimes: [],
      filteredCrimes: [],
      monthCounts: {},
      publicationCadence: {
        ...crimeBaseline.publicationCadence,
        dataCurrentThroughMonth: null,
      },
      availability: {
        state: 'source_outage',
        message: 'Crime source outage: upstream timeout',
      },
      error: 'Crime source outage: upstream timeout',
    });

    render(
      <CrimeDataProvider>
        <CameraDataProvider>
          <LeftPanel />
        </CameraDataProvider>
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/data current through:/i)).toBeInTheDocument();
    expect(screen.getByText(/source unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/^no published data$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/crime source state:/i)).toBeInTheDocument();
  });
});
