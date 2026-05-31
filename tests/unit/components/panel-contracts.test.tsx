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
import Header from '@/components/layout/Header';
import LeftPanel from '@/components/layout/LeftPanel';
import CCTVGrid from '@/components/cctv/CCTVGrid';
import { useAppStore } from '@/store/appStore';

const mockedUseCrimeData = vi.mocked(useCrimeData);
const mockedUseCameraData = vi.mocked(useCameraData);

describe('screenshot panel contracts', () => {
  beforeEach(() => {
    const recentSnapshot = new Date().toISOString();

    useAppStore.setState({
      notifications: [],
      unreadCount: 0,
      selectedCamera: null,
      selectedCrimeId: null,
      showHeatmap: false,
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
      ],
      filters: [{ category: 'violent-crime', enabled: true }],
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
      ],
      monthCounts: { '2026-02': 1 },
      selectedMonth: null,
      setSelectedMonth: vi.fn(),
      toggleFilter: vi.fn(),
      refresh: vi.fn(async () => undefined),
    });

    mockedUseCameraData.mockReturnValue({
      cameras: [
        {
          id: 'cam-1',
          name: 'Farringdon Road',
          type: 'traffic',
          provider: 'tfl',
          coordinates: { lat: 51.52, lng: -0.105 },
          streamUrl: 'https://example.com/cam-1.jpg',
          status: 'active',
          lastVerified: recentSnapshot,
          feedType: 'snapshot',
        },
      ],
      statuses: { 'cam-1': 'snapshot' },
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
  });

  it('keeps required header affordances', () => {
    render(
      <CrimeDataProvider>
        <Header onOpenSettings={vi.fn()} />
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/holborn, london/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/low|medium|elevated|high|critical/i)).toBeInTheDocument();
  });

  it('keeps required left-panel labels and sections', () => {
    render(
      <CrimeDataProvider>
        <CameraDataProvider>
          <LeftPanel />
        </CameraDataProvider>
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/live monitoring/i)).toBeInTheDocument();
    expect(screen.getByText(/crime incidents/i)).toBeInTheDocument();
    expect(screen.getByText(/filter by category/i)).toBeInTheDocument();
  });

  it('keeps required CCTV panel labels and snapshot badge', () => {
    render(
      <CameraDataProvider>
        <CCTVGrid standalone />
      </CameraDataProvider>,
    );

    expect(screen.getByText(/cctv feeds/i)).toBeInTheDocument();
    expect(screen.getAllByText(/snapshot/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/last captured:/i)).toBeInTheDocument();
  });
});
