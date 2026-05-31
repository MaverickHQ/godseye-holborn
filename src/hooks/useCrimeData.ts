import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Crime, CrimeFilter } from '@/types';
import { getCrimesInHolborn, ALL_CRIME_CATEGORIES } from '@/services/policeApi';
import { useAppStore } from '@/store/appStore';
import { resolveCrimePublicationCadence, type CrimePublicationCadence } from '@/services/crimeCadence';
import { getCrimePollInterval } from '@/config/dataPolling';
import { sanitizeCrimePayload } from '@/utils/dataContractGuards';
import {
  createCrimeAvailability,
  isFutureCrimeMonth,
  type CrimeAvailability,
} from '@/utils/crimeAvailability';
import {
  applyPollingOutcome,
  createInitialPollingState,
  resolveNextPollDelay,
  type PollingOutcome,
  type PollingPolicy,
  type PollingState,
} from '@/utils/pollingPolicy';

const CRIME_POLL_INTERVAL_MS = getCrimePollInterval();
const HOURS = 60 * 60 * 1000;
const CRIME_BASE_REFRESH_MS = Math.max(CRIME_POLL_INTERVAL_MS, 6 * HOURS);
const CRIME_POLICY_MAX_MS = Math.max(24 * HOURS, CRIME_BASE_REFRESH_MS * 4);
const CRIME_STALE_THRESHOLD_MS = Math.max(2 * 24 * HOURS, CRIME_POLICY_MAX_MS * 2);
const CRIME_LAST_KNOWN_CACHE_KEY = 'godseye-crime-last-known-good-v1';
const CRIME_DEFAULT_LAG_CAVEAT =
  'Police UK street-level crime data is published monthly and may lag by several weeks.';

export interface CrimeRefreshState {
  source: 'crime';
  consecutiveFailures: number;
  circuitOpen: boolean;
  nextDelayMs: number;
  nextAttemptAt: Date | null;
}

interface UseCrimeDataReturn {
  crimes: Crime[];
  filters: CrimeFilter[];
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  availability?: CrimeAvailability;
  publicationCadence: CrimePublicationCadence;
  lastUpdated: Date | null;
  refreshState: CrimeRefreshState;
  filteredCrimes: Crime[];
  monthCounts: Record<string, number>;
  selectedMonth: string | null;
  setSelectedMonth: (month: string | null) => void;
  toggleFilter: (category: string) => void;
  refresh: () => Promise<void>;
}

function buildCrimePolicy(baseIntervalMs: number): PollingPolicy {
  return {
    source: 'crime',
    baseIntervalMs,
    minIntervalMs: Math.min(baseIntervalMs, CRIME_BASE_REFRESH_MS),
    maxIntervalMs: CRIME_POLICY_MAX_MS,
    jitterRatio: 0.1,
    failureBackoffMultiplier: 2,
    circuitBreakerFailureThreshold: 2,
    circuitBreakerCooldownMs: Math.max(12 * HOURS, baseIntervalMs * 2),
    rateLimitBackoffMs: Math.max(12 * HOURS, baseIntervalMs * 2),
  };
}

function cadenceAwareBaseIntervalMs(cadence: CrimePublicationCadence): number {
  const lagMonths = cadence.lagMonths;
  if (lagMonths === null) {
    return CRIME_BASE_REFRESH_MS;
  }
  if (lagMonths <= 0) {
    return Math.max(24 * HOURS, CRIME_BASE_REFRESH_MS);
  }
  if (lagMonths === 1) {
    return Math.max(12 * HOURS, CRIME_BASE_REFRESH_MS);
  }
  return Math.max(6 * HOURS, CRIME_BASE_REFRESH_MS);
}

function parseRetryAfterMs(headerValue: unknown): number | undefined {
  if (typeof headerValue === 'number' && Number.isFinite(headerValue) && headerValue > 0) {
    return headerValue * 1_000;
  }
  if (typeof headerValue !== 'string') return undefined;
  const numeric = Number(headerValue);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric * 1_000;
  }
  const dateMs = Date.parse(headerValue);
  if (Number.isNaN(dateMs)) return undefined;
  const delta = dateMs - Date.now();
  return delta > 0 ? delta : undefined;
}

function classifyPollingOutcome(error: unknown): { outcome: PollingOutcome; retryAfterMs?: number } {
  const candidate = error as
    | {
        status?: number;
        message?: string;
        retryAfterMs?: number;
        response?: {
          status?: number;
          headers?: Record<string, unknown>;
        };
      }
    | undefined;

  const status = candidate?.response?.status ?? candidate?.status;
  const retryAfterHeader =
    candidate?.response?.headers?.['retry-after'] ?? candidate?.response?.headers?.['Retry-After'];
  const retryAfterMs = candidate?.retryAfterMs ?? parseRetryAfterMs(retryAfterHeader);
  const message = candidate?.message?.toLowerCase() ?? '';

  if (status === 429 || message.includes('rate limit') || message.includes('429')) {
    return {
      outcome: 'rate_limited',
      retryAfterMs,
    };
  }

  return { outcome: 'failure' };
}

function staleReasonFromError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('schema drift')) {
    return 'crime payload schema drift fallback engaged';
  }
  return 'crime polling degraded - serving last-known-good publication data';
}

function toRefreshState(policy: PollingPolicy, state: PollingState, nowMs: number): CrimeRefreshState {
  const nextDelayMs = resolveNextPollDelay({ policy, state, nowMs });
  return {
    source: 'crime',
    consecutiveFailures: state.consecutiveFailures,
    circuitOpen: Boolean(state.circuitOpenUntilMs && state.circuitOpenUntilMs > nowMs),
    nextDelayMs,
    nextAttemptAt: new Date(nowMs + nextDelayMs),
  };
}

interface CachedCrimeSnapshot {
  storedAt: string;
  publicationMonth: string | null;
  crimes: Crime[];
}

function latestCrimeMonth(crimes: Crime[]): string | null {
  const months = crimes.map(crime => crime.month).filter(Boolean);
  if (months.length === 0) return null;
  return months.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function readCachedCrimeSnapshot(): CachedCrimeSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CRIME_LAST_KNOWN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCrimeSnapshot>;
    const crimes = sanitizeCrimePayload(parsed.crimes).valid;
    if (crimes.length === 0) {
      return null;
    }
    const publicationMonth = parsed.publicationMonth ?? latestCrimeMonth(crimes);
    return {
      storedAt: typeof parsed.storedAt === 'string' ? parsed.storedAt : new Date().toISOString(),
      publicationMonth,
      crimes,
    };
  } catch {
    return null;
  }
}

function persistCrimeSnapshot(snapshot: CachedCrimeSnapshot): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CRIME_LAST_KNOWN_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort cache only.
  }
}

function withPublicationFallback(
  cadence: CrimePublicationCadence,
  fallbackMonth: string | null,
): CrimePublicationCadence {
  if (cadence.dataCurrentThroughMonth) {
    return cadence;
  }
  return {
    ...cadence,
    dataCurrentThroughMonth: fallbackMonth,
  };
}

export function useCrimeData(months: number = 3): UseCrimeDataReturn {
  const crimeSearchRadius = useAppStore(state => state.crimeSearchRadius);
  const cachedSnapshotRef = useRef<CachedCrimeSnapshot | null>(readCachedCrimeSnapshot());
  const cachedCrimes = cachedSnapshotRef.current?.crimes ?? [];
  const cachedPublicationMonth = cachedSnapshotRef.current?.publicationMonth ?? latestCrimeMonth(cachedCrimes);
  const [crimes, setCrimes] = useState<Crime[]>(cachedCrimes);
  const [filters, setFilters] = useState<CrimeFilter[]>(
    ALL_CRIME_CATEGORIES.map(category => ({
      category,
      enabled: true,
    })),
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicationCadence, setPublicationCadence] = useState<CrimePublicationCadence>({
    dataCurrentThroughMonth: cachedPublicationMonth,
    nextExpectedReleaseWindow: 'Unavailable (source check pending)',
    lagMonths: null,
    sourceLagCaveat: CRIME_DEFAULT_LAG_CAVEAT,
    checkedAt: cachedSnapshotRef.current?.storedAt ?? new Date(0).toISOString(),
  });
  const [availability, setAvailability] = useState<CrimeAvailability>(() =>
    createCrimeAvailability(
      cachedCrimes.length > 0 ? 'available' : 'no_publication',
      cachedCrimes.length > 0
        ? 'Using cached crime publication while source refresh initializes'
        : 'Awaiting crime source publication check',
    ),
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const policyRef = useRef<PollingPolicy>(buildCrimePolicy(CRIME_BASE_REFRESH_MS));
  const pollState = useRef<PollingState>(createInitialPollingState(policyRef.current));
  const [refreshState, setRefreshState] = useState<CrimeRefreshState>(() =>
    toRefreshState(policyRef.current, pollState.current, Date.now()),
  );

  const lastSuccessfulPoll = useRef<Date | null>(null);
  const lastKnownGoodCrimes = useRef<Crime[]>(cachedCrimes);
  const lastKnownPublicationMonth = useRef<string | null>(cachedPublicationMonth);
  const missedPolls = useRef(0);
  const pollTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleCheckIntervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCrimes = useCallback(async () => {
    const nowMs = Date.now();

    try {
      setIsLoading(true);
      setError(null);

      const [data, cadence] = await Promise.all([
        getCrimesInHolborn(months, crimeSearchRadius),
        resolveCrimePublicationCadence(),
      ]);
      const contract = sanitizeCrimePayload(data);
      const latestFromPayload = latestCrimeMonth(contract.valid);
      const publicationMonthFallback = latestFromPayload ?? lastKnownPublicationMonth.current;
      const mergedCadence = withPublicationFallback(cadence, publicationMonthFallback);
      if (contract.invalidCount > 0) {
        setError(
          `Detected ${contract.invalidCount} crime payload schema drift record(s); valid subset preserved`,
        );
      }
      if (contract.valid.length === 0) {
        const availabilityState = contract.invalidCount > 0 ? 'schema_drift' : 'no_publication';
        const noDataMessage =
          contract.invalidCount > 0
            ? `Crime payload schema drift: no valid records (${contract.errors.slice(0, 2).join(' | ') || 'unknown contract violation'})`
            : 'No published crime data found in configured lookback window';

        if (lastKnownGoodCrimes.current.length > 0) {
          setCrimes(lastKnownGoodCrimes.current);
          setPublicationCadence(
            withPublicationFallback(mergedCadence, lastKnownPublicationMonth.current),
          );
          setLastUpdated(new Date());
          lastSuccessfulPoll.current = new Date();
          missedPolls.current = 0;
          setIsStale(true);
          const fallbackMessage = `${noDataMessage} (serving last-known-good publication data)`;
          setError(fallbackMessage);
          setAvailability(createCrimeAvailability(availabilityState, fallbackMessage));
          pollState.current = applyPollingOutcome({
            policy: policyRef.current,
            state: pollState.current,
            outcome: 'success',
            nowMs,
          });
          setRefreshState(toRefreshState(policyRef.current, pollState.current, nowMs));
          return;
        }

        setCrimes([]);
        setPublicationCadence(mergedCadence);
        setLastUpdated(new Date());
        lastSuccessfulPoll.current = new Date();
        missedPolls.current = 0;
        setIsStale(true);
        setError(noDataMessage);
        setAvailability(createCrimeAvailability(availabilityState, noDataMessage));
        pollState.current = applyPollingOutcome({
          policy: policyRef.current,
          state: pollState.current,
          outcome: 'success',
          nowMs,
        });
        setRefreshState(toRefreshState(policyRef.current, pollState.current, nowMs));
        return;
      }

      setCrimes(contract.valid);
      lastKnownGoodCrimes.current = contract.valid;
      const resolvedPublicationMonth = latestFromPayload ?? mergedCadence.dataCurrentThroughMonth;
      lastKnownPublicationMonth.current = resolvedPublicationMonth;
      setPublicationCadence(mergedCadence);
      policyRef.current = buildCrimePolicy(cadenceAwareBaseIntervalMs(mergedCadence));
      setLastUpdated(new Date());
      lastSuccessfulPoll.current = new Date();
      missedPolls.current = 0;
      const hasFutureMonth = isFutureCrimeMonth(resolvedPublicationMonth, new Date(nowMs));
      if (hasFutureMonth) {
        const futureMessage = `Future-dated crime publication detected (${resolvedPublicationMonth || 'unknown month'})`;
        setIsStale(true);
        setError(futureMessage);
        setAvailability(createCrimeAvailability('future_month', futureMessage));
      } else if (contract.invalidCount > 0) {
        const driftMessage = `Detected ${contract.invalidCount} crime payload schema drift record(s); valid subset preserved`;
        setIsStale(true);
        setError(driftMessage);
        setAvailability(createCrimeAvailability('schema_drift', driftMessage));
      } else {
        setIsStale(false);
        setError(null);
        setAvailability(createCrimeAvailability('available'));
      }
      persistCrimeSnapshot({
        storedAt: new Date().toISOString(),
        publicationMonth: resolvedPublicationMonth,
        crimes: contract.valid,
      });
      pollState.current = applyPollingOutcome({
        policy: policyRef.current,
        state: pollState.current,
        outcome: 'success',
        nowMs,
      });
      setRefreshState(toRefreshState(policyRef.current, pollState.current, nowMs));
    } catch (err) {
      missedPolls.current += 1;
      const message = err instanceof Error ? err.message : 'Failed to fetch crime data';
      const outageMessage = message.toLowerCase().includes('source outage')
        ? message
        : `Crime source outage: ${message}`;
      if (lastKnownGoodCrimes.current.length > 0) {
        setCrimes(lastKnownGoodCrimes.current);
        setIsStale(true);
      }
      if (missedPolls.current >= 2) {
        setIsStale(true);
      }
      const { outcome, retryAfterMs } = classifyPollingOutcome(err);
      pollState.current = applyPollingOutcome({
        policy: policyRef.current,
        state: pollState.current,
        outcome,
        retryAfterMs,
        nowMs,
      });
      setRefreshState(toRefreshState(policyRef.current, pollState.current, nowMs));
      if (lastKnownGoodCrimes.current.length > 0) {
        setError(`${outageMessage} (${staleReasonFromError(message)})`);
      } else {
        setError(outageMessage);
      }
      setAvailability(createCrimeAvailability('source_outage', outageMessage));
    } finally {
      setIsLoading(false);
    }
  }, [crimeSearchRadius, months]);

  const refresh = useCallback(async () => {
    await fetchCrimes();
  }, [fetchCrimes]);

  const toggleFilter = useCallback((category: string) => {
    setFilters(previous =>
      previous.map(filter =>
        filter.category === category ? { ...filter, enabled: !filter.enabled } : filter,
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const nowMs = Date.now();
      const delayMs = resolveNextPollDelay({
        policy: policyRef.current,
        state: pollState.current,
        nowMs,
      });
      setRefreshState({
        source: 'crime',
        consecutiveFailures: pollState.current.consecutiveFailures,
        circuitOpen: Boolean(
          pollState.current.circuitOpenUntilMs && pollState.current.circuitOpenUntilMs > nowMs,
        ),
        nextDelayMs: delayMs,
        nextAttemptAt: new Date(nowMs + delayMs),
      });

      pollTimeoutId.current = setTimeout(async () => {
        await fetchCrimes();
        scheduleNext();
      }, delayMs);
    };

    fetchCrimes().finally(() => {
      scheduleNext();
    });

    staleCheckIntervalId.current = setInterval(() => {
      if (!lastSuccessfulPoll.current) return;

      const timeSinceLastPoll = Date.now() - lastSuccessfulPoll.current.getTime();
      if (timeSinceLastPoll > CRIME_STALE_THRESHOLD_MS) {
        setIsStale(true);
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (pollTimeoutId.current) {
        clearTimeout(pollTimeoutId.current);
      }
      if (staleCheckIntervalId.current) {
        clearInterval(staleCheckIntervalId.current);
      }
    };
  }, [fetchCrimes]);

  const monthCounts = useMemo<Record<string, number>>(() => {
    const source = Array.isArray(crimes) ? crimes : [];
    return source.reduce<Record<string, number>>((accumulator, crime) => {
      accumulator[crime.month] = (accumulator[crime.month] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [crimes]);

  const filteredCrimes = useMemo(() => {
    const source = Array.isArray(crimes) ? crimes : [];
    return source.filter(crime => {
      const categoryEnabled = filters.find(filter => filter.category === crime.category)?.enabled;
      if (!categoryEnabled) return false;
      if (selectedMonth && crime.month !== selectedMonth) return false;
      return true;
    });
  }, [crimes, filters, selectedMonth]);

  return {
    crimes,
    filters,
    isLoading,
    isStale,
    error,
    availability,
    publicationCadence,
    lastUpdated,
    refreshState,
    filteredCrimes,
    monthCounts,
    selectedMonth,
    setSelectedMonth,
    toggleFilter,
    refresh,
  };
}

export default useCrimeData;
