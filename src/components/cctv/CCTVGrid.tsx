import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { useCameraContext } from '@/contexts/CameraDataContext';
import LazyVideoPlayer from './LazyVideoPlayer';

interface CCTVGridProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  standalone?: boolean;
}

export default function CCTVGrid({
  isCollapsed = false,
  onToggleCollapse,
  standalone = false,
}: CCTVGridProps) {
  const {
    cameras,
    statuses,
    isLoading,
    isStale,
    error,
    staleReason,
    lastUpdated,
    refreshState = {
      source: 'camera',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 60_000,
      nextAttemptAt: null,
    },
  } = useCameraContext();
  const { selectedCamera, setSelectedCamera } = useAppStore();
  const sortedCameras = [...cameras].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full min-h-0" role="region" aria-label="CCTV Camera Feeds">
      {/* Header */}
      <div
        className={`panel-header ${!standalone ? 'cursor-pointer' : ''}`}
        onClick={!standalone ? onToggleCollapse : undefined}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <div>
            <h2 id="cctv-panel-title" className="text-sm font-semibold text-slate-100">
              CCTV Feeds
            </h2>
            <p className="text-xs text-slate-400">{sortedCameras.length} cameras in range</p>
          </div>
        </div>
        {!standalone && (
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Camera list - collapsible */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-mono text-red-300">{error}</p>
            </div>
          )}
          {isLoading && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <p className="text-xs text-slate-400">Loading camera snapshots...</p>
            </div>
          )}
          {!isLoading && sortedCameras.length === 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <p className="text-xs text-slate-400">No cameras currently available.</p>
            </div>
          )}
          {sortedCameras.map(camera => {
            const streamStatus = statuses[camera.id] || (camera.status === 'active' ? 'snapshot' : 'offline');
            return (
              <motion.div
                key={camera.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  panel p-3 cursor-pointer transition-all
                  ${selectedCamera?.id === camera.id ? 'border-cyan-400 bg-slate-700/50' : 'hover:border-slate-600'}
                `}
                onClick={() => setSelectedCamera(camera)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-slate-100">{camera.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {camera.coordinates.lat.toFixed(4)}, {camera.coordinates.lng.toFixed(4)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Source: TfL JamCam snapshot</p>
                  </div>
                  <StatusBadge status={streamStatus} feedType={camera.feedType} />
                </div>

                {selectedCamera?.id === camera.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 overflow-hidden"
                  >
                    <LazyVideoPlayer camera={camera} className="w-full min-h-[180px] aspect-video" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-700">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Last captured: {lastUpdated ? lastUpdated.toLocaleTimeString('en-GB') : '—'}</span>
              <span className="flex items-center gap-2 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Snapshot</span>
                <span className="mx-1">•</span>
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Snapshot-aged</span>
                <span className="mx-1">•</span>
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span>Stale</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Feed origin: TfL Open Data via AWS Lambda proxy</p>
            <p className="text-[10px] text-slate-500">
              Next poll: {refreshState.nextAttemptAt ? refreshState.nextAttemptAt.toLocaleTimeString('en-GB') : '—'}
            </p>
            <p className="text-[10px] text-slate-500">Polling budget: {Math.round(refreshState.nextDelayMs / 1000)}s</p>
            {isStale && (
              <p className="text-[10px] text-amber-400 font-mono">
                Camera snapshot stale - last known snapshot retained
              </p>
            )}
            {!isStale && refreshState.consecutiveFailures > 0 && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Last known snapshot retained while refresh retries
              </p>
            )}
            {refreshState.circuitOpen && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Backoff active after {refreshState.consecutiveFailures} failures
              </p>
            )}
            {isStale && staleReason && (
              <p className="text-[10px] text-amber-300/90 font-mono">Reason: {staleReason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, feedType }: { status: string; feedType?: 'snapshot' }) {
  if (status === 'inactive' || status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 bg-red-500 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-xs text-white uppercase">Offline</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 bg-red-500 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-xs text-white uppercase">Error</span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-1.5 bg-amber-500 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-xs text-white uppercase">Loading</span>
      </div>
    );
  }

  if (status === 'stale') {
    return (
      <div className="flex items-center gap-1.5 bg-orange-500 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-xs text-white uppercase">Stale</span>
      </div>
    );
  }

  if (status === 'snapshot-aged') {
    return (
      <div className="flex items-center gap-1.5 bg-sky-500 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-xs text-white">Snapshot-aged</span>
      </div>
    );
  }

  if (feedType === 'snapshot' || status === 'snapshot') {
    return (
      <div className="flex items-center gap-1.5 bg-amber-500 rounded-full px-2 py-0.5">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span className="text-xs text-white">Snapshot</span>
      </div>
    );
  }

  return null;
}
