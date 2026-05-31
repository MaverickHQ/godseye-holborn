import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimation } from '@/hooks/useAnimation';

describe('useAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => 
      useAnimation({ duration: 7000 })
    );

    expect(result.current.phase).toBe('space');
    expect(result.current.progress).toBe(0);
    expect(result.current.isTransitioning).toBe(false);
  });

  it('should start animation when start is called', () => {
    const { result } = renderHook(() => 
      useAnimation({ duration: 7000 })
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.isTransitioning).toBe(true);
  });

  it('should update phase based on progress', () => {
    const { result } = renderHook(() => 
      useAnimation({ 
        duration: 10000,
        phases: [
          { name: 'space', threshold: 0 },
          { name: 'uk', threshold: 0.3 },
          { name: 'london', threshold: 0.6 },
          { name: 'city', threshold: 1.0 },
        ]
      })
    );

    act(() => {
      result.current.start();
    });

    // Advance to 25% progress (between space and uk)
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.phase).toBe('space');
    expect(result.current.progress).toBeCloseTo(0.25, 1);
  });

  it('should call onComplete when animation finishes', () => {
    const onComplete = vi.fn();
    
    const { result } = renderHook(() => 
      useAnimation({ 
        duration: 1000,
        onComplete,
      })
    );

    act(() => {
      result.current.start();
    });

    // Advance past the duration (add small buffer for animation loop timing)
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isTransitioning).toBe(false);
  });

  it('should stop animation when stop is called', () => {
    const { result } = renderHook(() => 
      useAnimation({ duration: 10000 })
    );

    act(() => {
      result.current.start();
    });

    // Advance some time
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isTransitioning).toBe(false);
    expect(result.current.progress).toBeGreaterThan(0);
  });

  it('should reset animation state', () => {
    const { result } = renderHook(() => 
      useAnimation({ duration: 10000 })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.progress).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.phase).toBe('space');
    expect(result.current.isTransitioning).toBe(false);
  });

  it('should not start if already transitioning', () => {
    const { result } = renderHook(() => 
      useAnimation({ duration: 10000 })
    );

    act(() => {
      result.current.start();
    });

    const progressBefore = result.current.progress;

    // Try to start again while running
    act(() => {
      result.current.start();
    });

    // Progress should not reset
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeGreaterThan(progressBefore);
  });

  it('should handle custom phases', () => {
    const { result } = renderHook(() => 
      useAnimation({ 
        duration: 1000,
        phases: [
          { name: 'space', threshold: 0 },
          { name: 'uk', threshold: 0.5 },
          { name: 'london', threshold: 1.0 },
        ]
      })
    );

    act(() => {
      result.current.start();
    });

    // Advance to 75% (should be in 'uk' phase since that's between space and london)
    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(result.current.phase).toBe('uk');
  });

  it('should auto-start when autoStart is true', () => {
    const { result } = renderHook(() => 
      useAnimation({ 
        duration: 10000,
        autoStart: true,
      })
    );

    expect(result.current.isTransitioning).toBe(true);
  });
});
