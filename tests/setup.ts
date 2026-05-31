import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createElement } from 'react';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Mock Leaflet
vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(),
    map: vi.fn(),
    marker: vi.fn(),
    tileLayer: vi.fn(),
    popup: vi.fn(),
  },
  icon: vi.fn(),
  map: vi.fn(),
  marker: vi.fn(),
  tileLayer: vi.fn(),
  popup: vi.fn(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tagName: string) => {
        return ({ children, ...props }: any) => {
          return createElement(tagName, props, children);
        };
      },
    },
  ),
  AnimatePresence: ({ children }: any) => children,
}));

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_TFL_API_KEY: 'test-key',
  },
  writable: true,
});
