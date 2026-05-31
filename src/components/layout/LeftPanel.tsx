import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useActiveLocation } from '@/store/appStore';
import { useCrimeContext } from '@/contexts/CrimeDataContext';
import { useCameraContext } from '@/contexts/CameraDataContext';
import { CRIME_LABELS, CRIME_COLORS } from '@/config/theme';
import type { Crime } from '@/types';

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatMonthShort(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function sortedByMonth(crimes: Crime[]): Crime[] {
  return [...crimes].sort((a, b) => b.month.localeCompare(a.month));
}

function formatIntervalMs(ms: number): string {
  const roundedMinutes = Math.round(ms / 60_000);
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const hours = Math.round((roundedMinutes / 60) * 10) / 10;
  return `${hours}h`;
}

export default function LeftPanel() {
  const activeLocation = useActiveLocation();
  const {
    cameras,
    isStale: isCameraStale,
    error: cameraError,
    staleReason: cameraStaleReason,
    lastUpdated: cameraLastUpdated,
    refreshState: cameraRefreshState = {
      source: 'camera',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 60_000,
      nextAttemptAt: null,
    },
  } = useCameraContext();
  const {
    crimes,
    filteredCrimes,
    filters,
    isLoading,
    isStale: isCrimeStale,
    error,
    availability,
    publicationCadence,
    lastUpdated,
    refreshState: crimeRefreshState = {
      source: 'crime',
      consecutiveFailures: 0,
      circuitOpen: false,
      nextDelayMs: 6 * 60 * 60 * 1000,
      nextAttemptAt: null,
    },
    toggleFilter,
    monthCounts,
    selectedMonth,
    setSelectedMonth,
  } = useCrimeContext();
  const { showHeatmap, toggleHeatmap, selectedCrimeId, setSelectedCrimeId } = useAppStore();

  const crimeByCategory = useMemo(
    () =>
      crimes.reduce(
        (acc, crime) => {
          acc[crime.category] = (acc[crime.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [crimes],
  );

  const recentIncidents = useMemo(
    () => sortedByMonth(filteredCrimes).slice(0, 30),
    [filteredCrimes],
  );

  const latestPublishedCrimeMonth = useMemo(() => {
    if (publicationCadence.dataCurrentThroughMonth) {
      return formatMonth(publicationCadence.dataCurrentThroughMonth);
    }

    const months = Object.keys(monthCounts);
    if (months.length === 0) {
      return null;
    }

    const latest = months.sort((a, b) => b.localeCompare(a))[0];
    return formatMonth(latest);
  }, [monthCounts, publicationCadence.dataCurrentThroughMonth]);

  const crimeCurrentThroughLabel = useMemo(() => {
    if (latestPublishedCrimeMonth) {
      return latestPublishedCrimeMonth;
    }
    if (availability?.state === 'source_outage') {
      return 'Source unavailable';
    }
    if (availability?.state === 'future_month') {
      return 'Future-dated publication';
    }
    return 'No published data';
  }, [availability?.state, latestPublishedCrimeMonth]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Live Monitoring */}
      <div className="p-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
            Live Monitoring
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Location</p>
            <p className="text-xs text-cyan-400 mt-0.5 leading-snug">{activeLocation.address}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Coordinates</p>
            <p className="font-mono text-[11px] text-slate-300 mt-0.5">
              {activeLocation.lat.toFixed(4)}°N, {Math.abs(activeLocation.lng).toFixed(4)}°W
            </p>
          </div>
          <div className="flex gap-4 pt-1">
            <div>
              <p className="text-lg font-semibold text-slate-100 tabular-nums">{cameras.length}</p>
              <p className="text-[10px] text-slate-500">Cameras</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-100 tabular-nums">
                {isLoading ? '…' : filteredCrimes.length}
              </p>
              <p className="text-[10px] text-slate-500">Incidents</p>
            </div>
          </div>
          <div className="pt-1 space-y-1">
            <p className="text-[10px] text-slate-500">
              Camera Source: <span className="text-slate-400">TfL JamCam snapshots (via AWS proxy)</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Snapshot updated:{' '}
              <span className="text-slate-400">
                {cameraLastUpdated
                  ? cameraLastUpdated.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </p>
            <p className="text-[10px] text-slate-500">
              Snapshot refresh budget:{' '}
              <span className="text-slate-400">{formatIntervalMs(cameraRefreshState.nextDelayMs)}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Snapshot next check:{' '}
              <span className="text-slate-400">
                {cameraRefreshState.nextAttemptAt
                  ? cameraRefreshState.nextAttemptAt.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </p>
            <p className="text-[10px] text-slate-500">
              Crime Source: <span className="text-slate-400">Police UK (monthly publication)</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Data current through:{' '}
              <span className="text-slate-400">{crimeCurrentThroughLabel}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Next expected release window:{' '}
              <span className="text-slate-400">{publicationCadence.nextExpectedReleaseWindow}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Crime source refresh budget:{' '}
              <span className="text-slate-400">{formatIntervalMs(crimeRefreshState.nextDelayMs)}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Crime source next check:{' '}
              <span className="text-slate-400">
                {crimeRefreshState.nextAttemptAt
                  ? crimeRefreshState.nextAttemptAt.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </p>
            <p className="text-[10px] text-slate-600">{publicationCadence.sourceLagCaveat}</p>
            {availability && availability.state !== 'available' && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Crime source state: {availability.state.replace(/_/g, ' ')} - {availability.message}
              </p>
            )}
            {isCrimeStale && (
              <p className="text-[10px] text-amber-400 font-mono">Crime data stale - showing last known publication</p>
            )}
            {crimeRefreshState.circuitOpen && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Crime refresh backoff active ({crimeRefreshState.consecutiveFailures} failures)
              </p>
            )}
            {isCameraStale && (
              <p className="text-[10px] text-amber-400 font-mono">
                Camera snapshot stale - last known snapshot retained
              </p>
            )}
            {!isCameraStale && cameraRefreshState.consecutiveFailures > 0 && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Last known snapshot retained while source refresh retries
              </p>
            )}
            {cameraRefreshState.circuitOpen && (
              <p className="text-[10px] text-amber-300/90 font-mono">
                Camera refresh backoff active ({cameraRefreshState.consecutiveFailures} failures)
              </p>
            )}
            {isCameraStale && cameraStaleReason && (
              <p className="text-[10px] text-amber-300/90 font-mono">Camera stale reason: {cameraStaleReason}</p>
            )}
          </div>
          {(error || cameraError) && (
            <p className="text-[10px] text-red-400 mt-1 font-mono">{error || cameraError}</p>
          )}
          {lastUpdated && !error && (
            <p className="text-[10px] text-slate-600 mt-1">
              Crime sync{' '}
              {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Crime Incidents header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-cyan-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-100">Crime Incidents</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
            {filteredCrimes.length}
          </span>
        </div>
        <button
          onClick={toggleHeatmap}
          className={`btn-icon text-xs font-medium px-2 gap-1 ${showHeatmap ? 'text-cyan-400 bg-slate-700/50' : ''}`}
          aria-label={showHeatmap ? 'Switch to pins' : 'Switch to heatmap'}
          title={showHeatmap ? 'Pins view' : 'Heatmap view'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {showHeatmap ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            ) : (
              <>
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <circle cx="12" cy="12" r="7" strokeWidth={1.5} opacity={0.5} />
                <circle cx="12" cy="12" r="11" strokeWidth={1} opacity={0.25} />
              </>
            )}
          </svg>
          <span className="text-[10px]">{showHeatmap ? 'Pins' : 'Heat'}</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-4">
        {/* Category filters */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            Filter by category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {filters.map(filter => (
              <button
                key={filter.category}
                onClick={() => toggleFilter(filter.category)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] transition-colors ${
                  filter.enabled ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-500'
                }`}
                role="checkbox"
                aria-checked={filter.enabled}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CRIME_COLORS[filter.category] || '#64748B' }}
                />
                <span className="capitalize">
                  {CRIME_LABELS[filter.category] || filter.category}
                </span>
                <span className="text-slate-400">{crimeByCategory[filter.category] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Month scrubber */}
        {Object.keys(monthCounts).length > 1 && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Month</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedMonth(null)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedMonth === null
                    ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              {Object.entries(monthCounts)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([month, count]) => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month === selectedMonth ? null : month)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      selectedMonth === month
                        ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${count} incidents`}
                  >
                    {formatMonthShort(month)}
                    <span className="ml-1 text-slate-500">{count}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Recent incidents */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            Recent incidents{selectedMonth ? ` — ${formatMonth(selectedMonth)}` : ''}
          </p>
          <div className="space-y-1.5">
            {recentIncidents.length === 0 &&
              (isLoading ? (
                <p className="text-[11px] text-slate-500 italic px-1">Loading incidents…</p>
              ) : (
                <p className="text-[11px] text-slate-500 italic px-1">
                  No incidents match the current filters.
                </p>
              ))}
            {recentIncidents.map(crime => {
              const color = CRIME_COLORS[crime.category] || '#64748B';
              const isSelected = selectedCrimeId === crime.id;
              return (
                <button
                  key={crime.id}
                  onClick={() => setSelectedCrimeId(isSelected ? null : crime.id)}
                  className={`w-full text-left flex items-start gap-2.5 p-2 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-slate-700 ring-1 ring-cyan-500/50'
                      : 'bg-slate-900/30 hover:bg-slate-800/50'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-200 truncate">
                      {CRIME_LABELS[crime.category] || crime.category}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {crime.street?.name || 'Unknown location'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {formatMonthShort(crime.month)}
                    </p>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 110-12 6 6 0 010 12zm0-9a1 1 0 011 1v3a1 1 0 01-2 0V8a1 1 0 011-1zm0 6a1 1 0 100 2 1 1 0 000-2z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
