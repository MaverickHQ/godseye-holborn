import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VideoPlayer from '@/components/cctv/VideoPlayer';

vi.mock('@/services/tflApi', () => ({
  getTrafficCameraProxyImageUrl: vi.fn(() => '/api/tfl/camera/JamCams_00001.03608/image'),
  getCameraSnapshotMetadata: vi.fn(async () => ({
    status: 'active',
    imageUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03608.jpg',
    lastVerified: '2026-05-31T17:20:44.000Z',
  })),
}));

const camera = {
  id: 'JamCams_00001.03608',
  name: 'Farringdon Rd/Cowcross St',
  type: 'traffic' as const,
  provider: 'tfl' as const,
  coordinates: { lat: 51.52, lng: -0.1059 },
  streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03608.jpg',
  status: 'active' as const,
  lastVerified: '2026-05-31T16:45:42.000Z',
  sourceCheckedAt: '2026-05-31T16:46:00.000Z',
  feedType: 'snapshot' as const,
};

describe('VideoPlayer proxy image fallback', () => {
  it('renders both source and observed snapshot timestamps', async () => {
    render(<VideoPlayer camera={camera} />);

    expect(screen.getByText(/source timestamp:/i)).toBeInTheDocument();
    expect(screen.getByText(/image observed:/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/31\/05\/2026/i)).toBeInTheDocument();
    });
  });

  it('falls back to proxy image endpoint when direct image fails', async () => {
    render(<VideoPlayer camera={camera} />);
    await waitFor(() => {
      expect(screen.getByText(/image observed:/i)).toBeInTheDocument();
    });

    const img = screen.getByAltText(/snapshot/i) as HTMLImageElement;
    expect(img.src).toContain('s3-eu-west-1.amazonaws.com');

    fireEvent.error(img);

    expect(img.src).toContain('/api/tfl/camera/JamCams_00001.03608/image');
    expect(screen.queryByText(/snapshot unavailable/i)).not.toBeInTheDocument();
  });

  it('shows unavailable overlay after proxy fallback also fails', async () => {
    render(<VideoPlayer camera={camera} />);
    await waitFor(() => {
      expect(screen.getByText(/image observed:/i)).toBeInTheDocument();
    });

    const img = screen.getByAltText(/snapshot/i) as HTMLImageElement;

    fireEvent.error(img); // switch to proxy source
    fireEvent.error(img); // proxy source fails

    expect(screen.getByText(/snapshot unavailable/i)).toBeInTheDocument();
  });
});
