import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useCameraData', () => ({
  useCameraData: vi.fn(),
}));

vi.mock('@/components/cctv/VideoPlayer', () => ({
  default: () => <div data-testid="video-player" />,
}));

import { useCameraData } from '@/hooks/useCameraData';
import { CameraDataProvider } from '@/contexts/CameraDataContext';
import CCTVGrid from '@/components/cctv/CCTVGrid';

const mockedUseCameraData = vi.mocked(useCameraData);

describe('CCTV snapshot semantics contract', () => {
  beforeEach(() => {
    const recentSnapshot = new Date().toISOString();

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
      ],
      statuses: { 'cam-1': 'snapshot' },
      cameraFreshness: {},
      isLoading: false,
      isStale: true,
      error: null,
      staleReason: 'source snapshot age exceeded stale threshold',
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
    });
  });

  it('uses snapshot freshness labels and excludes live-video language', () => {
    render(
      <CameraDataProvider>
        <CCTVGrid standalone />
      </CameraDataProvider>,
    );

    expect(screen.getAllByText(/snapshot/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/last captured:/i)).toBeInTheDocument();
    expect(screen.getByText(/camera snapshot stale/i)).toBeInTheDocument();
    expect(screen.queryByText(/^live$/i)).not.toBeInTheDocument();
  });
});
