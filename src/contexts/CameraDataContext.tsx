import { createContext, useContext, type ReactNode } from 'react';
import { useCameraData, type SourceRefreshState } from '@/hooks/useCameraData';
import type { CameraSource, StreamStatus } from '@/types';
import type { SnapshotFreshnessResult } from '@/utils/snapshotFreshness';

interface CameraDataContextValue {
  cameras: CameraSource[];
  statuses: Record<string, StreamStatus>;
  cameraFreshness: Record<string, SnapshotFreshnessResult>;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  staleReason: string | null;
  lastUpdated: Date | null;
  refreshState: SourceRefreshState;
  refresh: () => Promise<void>;
}

const CameraDataContext = createContext<CameraDataContextValue | null>(null);

export function CameraDataProvider({ children }: { children: ReactNode }) {
  const {
    cameras,
    statuses,
    cameraFreshness,
    isLoading,
    isStale,
    error,
    staleReason,
    lastUpdated,
    refreshState,
    refresh,
  } = useCameraData();
  return (
    <CameraDataContext.Provider
      value={{
        cameras,
        statuses,
        cameraFreshness,
        isLoading,
        isStale,
        error,
        staleReason,
        lastUpdated,
        refreshState,
        refresh,
      }}
    >
      {children}
    </CameraDataContext.Provider>
  );
}

export function useCameraContext(): CameraDataContextValue {
  const ctx = useContext(CameraDataContext);
  if (!ctx) throw new Error('useCameraContext must be used within CameraDataProvider');
  return ctx;
}
