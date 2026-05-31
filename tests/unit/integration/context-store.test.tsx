import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/hooks/useCrimeData', () => ({
  useCrimeData: vi.fn(),
}));

vi.mock('@/hooks/useCameraData', () => ({
  useCameraData: vi.fn(),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

vi.mock('@/components/cctv/LazyVideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

import { useCrimeData } from '@/hooks/useCrimeData';
import { useCameraData } from '@/hooks/useCameraData';
import { CrimeDataProvider } from '@/contexts/CrimeDataContext';
import { CameraDataProvider } from '@/contexts/CameraDataContext';
import LeftPanel from '@/components/layout/LeftPanel';
import CCTVGrid from '@/components/cctv/CCTVGrid';
import { useAppStore } from '@/store/appStore';

const mockedUseCrimeData = vi.mocked(useCrimeData);
const mockedUseCameraData = vi.mocked(useCameraData);

describe('screenshot context/store wiring', () => {
  beforeEach(() => {
    const recentSnapshot = new Date().toISOString();

    useAppStore.setState({
      selectedCamera: null,
    });

    (useAppStore.setState as unknown as (state: Record<string, unknown>) => void)({
      selectedCrimeId: null,
      showHeatmap: false,
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
        'cam-2': 'snapshot',
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
      ],
      filters: [
        { category: 'violent-crime', enabled: true },
        { category: 'other-theft', enabled: true },
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
      monthCounts: { '2026-02': 2 },
      selectedMonth: null,
      setSelectedMonth: vi.fn(),
      toggleFilter: vi.fn(),
      refresh: vi.fn(async () => undefined),
    });
  });

  it('hydrates left panel counts from contexts', () => {
    render(
      <CrimeDataProvider>
        <CameraDataProvider>
          <LeftPanel />
        </CameraDataProvider>
      </CrimeDataProvider>,
    );

    expect(screen.getByText(/live monitoring/i)).toBeInTheDocument();
    expect(screen.getByText(/cameras/i)).toBeInTheDocument();
    expect(screen.getAllByText(/incidents/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('updates store state when selecting incidents and cameras', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /violent crime/i }));
    expect((useAppStore.getState() as unknown as { selectedCrimeId: string | null }).selectedCrimeId).toBe('crime-1');

    const cameraTitle = screen.getByText('Farringdon Rd/Cowcross St');
    const cameraCard = cameraTitle.closest('.panel') as HTMLElement | null;
    expect(cameraCard).not.toBeNull();
    fireEvent.click(cameraCard as HTMLElement);
    expect(useAppStore.getState().selectedCamera?.id).toBe('cam-1');
  });
});
