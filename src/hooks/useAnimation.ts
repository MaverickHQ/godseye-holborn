import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnimationState, AnimationPhase } from '@/types';

export type { AnimationPhase } from '@/types';

export interface UseAnimationOptions {
  duration: number; // Total duration in ms
  phases?: AnimationPhase[]; // Defaults to space/uk/london/city phases
  autoStart?: boolean;
  onComplete?: () => void;
}

export interface UseAnimationReturn {
  phase: AnimationState['phase'];
  progress: number;
  isTransitioning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_PHASES: AnimationPhase[] = [
  { name: 'space', threshold: 0.3 },
  { name: 'uk', threshold: 0.55 },
  { name: 'london', threshold: 0.8 },
  { name: 'city', threshold: 1.0 },
];

export function useAnimation(options: UseAnimationOptions): UseAnimationReturn {
  const { 
    duration, 
    phases = DEFAULT_PHASES, 
    autoStart = false,
    onComplete 
  } = options;

  const [phase, setPhase] = useState<AnimationState['phase']>('space');
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(autoStart);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  // Calculate current phase based on progress
  const calculatePhase = useCallback((prog: number): AnimationState['phase'] => {
    for (let i = phases.length - 1; i >= 0; i--) {
      if (prog >= phases[i].threshold) {
        return phases[i].name;
      }
    }
    return phases[0]?.name || 'space';
  }, [phases]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isActiveRef.current || startTimeRef.current === null) return;

    const elapsed = Date.now() - startTimeRef.current;
    const currentProgress = Math.min(elapsed / duration, 1);

    setProgress(currentProgress);
    setPhase(calculatePhase(currentProgress));

    if (currentProgress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setIsTransitioning(false);
      isActiveRef.current = false;
      onComplete?.();
    }
  }, [duration, calculatePhase, onComplete]);

  // Start animation
  const start = useCallback(() => {
    if (isActiveRef.current) return;

    setIsTransitioning(true);
    setProgress(0);
    startTimeRef.current = Date.now();
    isActiveRef.current = true;
    animationRef.current = requestAnimationFrame(animate);
  }, [animate]);

  // Stop animation
  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsTransitioning(false);
  }, []);

  // Reset animation
  const reset = useCallback(() => {
    stop();
    setProgress(0);
    setPhase(phases[0]?.name || 'space');
    startTimeRef.current = null;
  }, [stop, phases]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }
  }, [autoStart, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    phase,
    progress,
    isTransitioning,
    start,
    stop,
    reset,
  };
}

export default useAnimation;
