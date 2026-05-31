import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/city/CityView', () => ({
  default: () => <div data-testid="city-view">City View</div>,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar-nav">Sidebar</div>,
}));

vi.mock('@/components/core/AlertBar', () => ({
  default: () => <div data-testid="alert-bar" />,
}));

vi.mock('@/contexts/CrimeDataContext', () => ({
  CrimeDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCrimeContext: () => ({
    crimes: [],
    filters: [],
    isLoading: true,
    isStale: false,
    error: null,
    publicationCadence: {
      dataCurrentThroughMonth: '2026-03',
      nextExpectedReleaseWindow: 'Late April 2026',
      sourceLagCaveat: 'Police UK publishes monthly data with source lag.',
    },
    lastUpdated: new Date('2026-02-26T21:26:00Z'),
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
    lastUpdated: new Date('2026-04-24T21:25:00Z'),
    refresh: vi.fn(),
  }),
}));

import App from '@/components/core/App';

describe('screenshot shell layout (desktop)', () => {
  test('renders left intelligence panel, center map, and right CCTV panel', () => {
    const { container } = render(<App />);

    expect(screen.getAllByText(/holborn, london/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/live monitoring/i)).toBeInTheDocument();
    expect(screen.getByText(/cctv feeds/i)).toBeInTheDocument();
    expect(screen.getByTestId('city-view')).toBeInTheDocument();

    const leftPanel = container.querySelector('aside.w-72');
    const rightPanel = container.querySelector('aside.w-80');
    expect(leftPanel).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
  });

  test('keeps map region as flexible center column between fixed side panels', () => {
    const { container } = render(<App />);

    const bodyRow = container.querySelector('div.flex.flex-1.min-h-0');
    expect(bodyRow).not.toBeNull();

    const mapMain = container.querySelector('main#main-content.flex-1.min-w-0.relative');
    expect(mapMain).not.toBeNull();
  });
});
