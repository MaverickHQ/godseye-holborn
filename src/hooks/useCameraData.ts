import { useState, useEffect, useCallback, useRef } from 'react';
import type { CameraSource, StreamStatus } from '@/types';
import { getAllTrafficCameras } from '@/services/tflApi';
import { getCameraPollInterval } from '@/config/dataPolling';
import { useAppStore } from '@/store/appStore';
import {
  assessSnapshotFreshness,
  DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
  type SnapshotFreshnessResult,
} from '@/utils/snapshotFreshness';
import {
  mapCameraFallbackErrorToStaleReason,
  mapSnapshotReasonToCameraStaleLabel,
} from '@/utils/cameraStaleReason';
import { sanitizeCameraPayload } from '@/utils/dataContractGuards';
import {
  applyPollingOutcome,
  createInitialPollingState,
  resolveNextPollDelay,
  type PollingOutcome,
  type PollingPolicy,
  type PollingState,
} from '@/utils/pollingPolicy';

const MIN_CAMERA_POLL_INTERVAL_MS = getCameraPollInterval();

function buildCameraPollingPolicy(baseIntervalMs: number): PollingPolicy {
  const interval = Math.max(baseIntervalMs, MIN_CAMERA_POLL_INTERVAL_MS);
  return {
    source: 'camera',
    baseIntervalMs: interval,
    minIntervalMs: interval,
    maxIntervalMs: Math.max(interval * 5, 5 * 60_000),
    jitterRatio: 0.15,
    failureBackoffMultiplier: 2,
    circuitBreakerFailureThreshold: 3,
    circuitBreakerCooldownMs: Math.max(interval * 3, 3 * 60_000),
    rateLimitBackoffMs: Math.max(interval * 4, 4 * 60_000),
  };
}

export interface SourceRefreshState {
  source: 'camera';
  consecutiveFailures: number;
  circuitOpen: boolean;
  nextDelayMs: number;
  nextAttemptAt: Date | null;
}

interface UseCameraDataReturn {
  cameras: CameraSource[];
  statuses: Record<string, StreamStatus>;
  cameraFreshness: Record<string, SnapshotFreshnessResult>;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  staleReason: string | null;
  lastUpdated: Date | null;
  selectedCamera: CameraSource | null;
  setSelectedCamera: (camera: CameraSource | null) => void;
  refreshState: SourceRefreshState;
  refresh: () => Promise<void>;
}

function mapFreshnessToStatus(freshness: SnapshotFreshnessResult): StreamStatus {
  if (freshness.status === 'fresh') {
    return 'snapshot';
  }

  if (freshness.status === 'aging') {
    return 'snapshot-aged';
  }

  if (freshness.status === 'stale') {
    return 'stale';
  }

  return 'offline';
}

function mapUnknownHeartbeatStatus(freshness: SnapshotFreshnessResult): StreamStatus {
  if (freshness.status !== 'unavailable') {
    return mapFreshnessToStatus(freshness);
  }

  if (freshness.reason === 'stream_url_missing') {
    return 'offline';
  }

  // Keep snapshot feeds visible in degraded mode when timestamp provenance is temporarily missing.
  return 'snapshot-aged';
}

function toValidIsoTimestamp(candidate: string | null | undefined): string {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return '';
  }

  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    return '';
  }

  return new Date(parsed).toISOString();
}

function pickFreshestTimestamp(...candidates: Array<string | null | undefined>): string {
  let freshestMs = Number.NEGATIVE_INFINITY;
  let freshest = '';

  candidates.forEach(candidate => {
    const iso = toValidIsoTimestamp(candidate);
    if (!iso) {
      return;
    }

    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed) && parsed > freshestMs) {
      freshestMs = parsed;
      freshest = iso;
    }
  });

  return freshest;
}

function isOperationallyUnhealthy(freshness: SnapshotFreshnessResult): boolean {
  if (freshness.status === 'stale') {
    return true;
  }

  if (freshness.status !== 'unavailable') {
    return false;
  }

  if (freshness.reason === 'source_timestamp_missing' || freshness.reason === 'source_timestamp_invalid') {
    return false;
  }

  return true;
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

function toRefreshState(policy: PollingPolicy, state: PollingState, nowMs: number): SourceRefreshState {
  const nextDelayMs = resolveNextPollDelay({
    policy,
    state,
    nowMs,
  });
  return {
    source: 'camera',
    consecutiveFailures: state.consecutiveFailures,
    circuitOpen: Boolean(state.circuitOpenUntilMs && state.circuitOpenUntilMs > nowMs),
    nextDelayMs,
    nextAttemptAt: new Date(nowMs + nextDelayMs),
  };
}

export function useCameraData(): UseCameraDataReturn {
  const cameraRefreshInterval = useAppStore(state => state.cameraRefreshInterval);
  const runtimePollIntervalMs = Math.max(cameraRefreshInterval, MIN_CAMERA_POLL_INTERVAL_MS);
  const [cameras, setCameras] = useState<CameraSource[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StreamStatus>>({});
  const [cameraFreshness, setCameraFreshness] = useState<Record<string, SnapshotFreshnessResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<CameraSource | null>(null);
  const policyRef = useRef<PollingPolicy>(buildCameraPollingPolicy(runtimePollIntervalMs));
  const pollState = useRef<PollingState>(createInitialPollingState(policyRef.current));
  const [refreshState, setRefreshState] = useState<SourceRefreshState>(() =>
    toRefreshState(policyRef.current, pollState.current, Date.now()),
  );

  const lastSuccessfulPoll = useRef<Date | null>(null);
  const lastKnownGoodState = useRef<{
    cameras: CameraSource[];
    statuses: Record<string, StreamStatus>;
    cameraFreshness: Record<string, SnapshotFreshnessResult>;
    lastUpdated: Date | null;
  }>({
    cameras: [],
    statuses: {},
    cameraFreshness: {},
    lastUpdated: null,
  });
  const missedPolls = useRef(0);
  const pollTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleCheckIntervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const failureByCameraId = useRef<Record<string, number>>({});
  const lastSourceTimestampByCameraId = useRef<Record<string, string>>({});

  const fetchCameras = useCallback(async () => {
    const observedAt = new Date();
    const nowMs = observedAt.getTime();

    try {
      setIsLoading(true);
      setError(null);

      const cameraList = await getAllTrafficCameras();
      const contract = sanitizeCameraPayload(cameraList);
      if (contract.invalidCount > 0) {
        setError(
          `Detected ${contract.invalidCount} camera payload schema drift record(s); valid subset preserved`,
        );
      }
      if (contract.valid.length === 0) {
        throw new Error(
          `Camera payload schema drift: no valid records (${contract.errors.slice(0, 2).join(' | ') || 'unknown contract violation'})`,
        );
      }

      const snapshotOnlyCameras = contract.valid.filter(
        (camera): camera is CameraSource => camera.feedType === 'snapshot',
      );
      const droppedFeedCount = contract.valid.length - snapshotOnlyCameras.length;

      setCameras(snapshotOnlyCameras);

      const newStatuses: Record<string, StreamStatus> = {};
      const freshnessByCamera: Record<string, SnapshotFreshnessResult> = {};

      snapshotOnlyCameras.forEach(camera => {
        const previousFailureCount = failureByCameraId.current[camera.id] ?? 0;
        const cachedSourceTimestamp = lastSourceTimestampByCameraId.current[camera.id];
        const sourceTimestamp = pickFreshestTimestamp(
          cachedSourceTimestamp,
          camera.sourceCheckedAt,
          camera.lastVerified,
        );
        const hasSourceTimestamp = Boolean(sourceTimestamp?.trim());
        const upstreamCameraStatus = camera.status;

        if (upstreamCameraStatus === 'inactive') {
          failureByCameraId.current[camera.id] = previousFailureCount + 1;
        } else if (hasSourceTimestamp) {
          // Timestamp movement is the source-of-truth heartbeat in snapshot-only mode.
          failureByCameraId.current[camera.id] = Math.max(0, previousFailureCount - 1);
        } else {
          failureByCameraId.current[camera.id] = previousFailureCount + 1;
        }

        if (sourceTimestamp) {
          lastSourceTimestampByCameraId.current[camera.id] = sourceTimestamp;
        }

        const freshness = assessSnapshotFreshness({
          sourceTimestamp,
          observedAt,
          failureCount: failureByCameraId.current[camera.id] ?? 0,
          hasStreamUrl: Boolean(camera.streamUrl),
          policy: DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        });

        freshnessByCamera[camera.id] = freshness;
        if (upstreamCameraStatus === 'inactive') {
          newStatuses[camera.id] = 'offline';
          return;
        }
        newStatuses[camera.id] = mapUnknownHeartbeatStatus(freshness);
      });

      setStatuses(newStatuses);
      setCameraFreshness(freshnessByCamera);

      const unhealthy = Object.values(freshnessByCamera).filter(isOperationallyUnhealthy);
      const healthy = Object.values(freshnessByCamera).filter(
        freshness => freshness.status === 'fresh' || freshness.status === 'aging',
      );

      setIsStale(unhealthy.length > 0 && healthy.length === 0);
      setStaleReason(unhealthy.length > 0 ? mapSnapshotReasonToCameraStaleLabel(unhealthy[0].reason) : null);

      if (droppedFeedCount > 0) {
        setError(`Blocked ${droppedFeedCount} non-snapshot camera feed(s)`);
      }
      if (contract.invalidCount > 0 && droppedFeedCount === 0) {
        setIsStale(true);
        setStaleReason('camera payload schema drift fallback engaged');
      }
      setLastUpdated(observedAt);
      lastKnownGoodState.current = {
        cameras: snapshotOnlyCameras,
        statuses: newStatuses,
        cameraFreshness: freshnessByCamera,
        lastUpdated: observedAt,
      };
      lastSuccessfulPoll.current = observedAt;
      missedPolls.current = 0;
      pollState.current = applyPollingOutcome({
        policy: policyRef.current,
        state: pollState.current,
        outcome: 'success',
        nowMs,
      });
      setRefreshState(toRefreshState(policyRef.current, pollState.current, nowMs));
    } catch (err) {
      missedPolls.current += 1;
      const message = err instanceof Error ? err.message : 'Failed to fetch camera data';
      if (lastKnownGoodState.current.cameras.length > 0) {
        setCameras(lastKnownGoodState.current.cameras);
        setStatuses(lastKnownGoodState.current.statuses);
        setCameraFreshness(lastKnownGoodState.current.cameraFreshness);
        setLastUpdated(lastKnownGoodState.current.lastUpdated);
        setIsStale(true);
        setStaleReason(mapCameraFallbackErrorToStaleReason(message));
      }
      if (missedPolls.current >= 2) {
        setIsStale(true);
        setStaleReason('camera polling failed repeatedly');
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
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    policyRef.current = buildCameraPollingPolicy(runtimePollIntervalMs);
    pollState.current = createInitialPollingState(policyRef.current);
    setRefreshState(toRefreshState(policyRef.current, pollState.current, Date.now()));
  }, [runtimePollIntervalMs]);

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
        source: 'camera',
        consecutiveFailures: pollState.current.consecutiveFailures,
        circuitOpen: Boolean(
          pollState.current.circuitOpenUntilMs && pollState.current.circuitOpenUntilMs > nowMs,
        ),
        nextDelayMs: delayMs,
        nextAttemptAt: new Date(nowMs + delayMs),
      });

      pollTimeoutId.current = setTimeout(async () => {
        await fetchCameras();
        scheduleNext();
      }, delayMs);
    };

    fetchCameras().finally(() => {
      scheduleNext();
    });

    staleCheckIntervalId.current = setInterval(() => {
      if (lastSuccessfulPoll.current) {
        const timeSinceLastPoll = Date.now() - lastSuccessfulPoll.current.getTime();
        if (timeSinceLastPoll > policyRef.current.maxIntervalMs * 2) {
          setIsStale(true);
          setStaleReason('camera polling exceeded stale threshold');
        }
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
  }, [fetchCameras]);

  return {
    cameras,
    statuses,
    cameraFreshness,
    isLoading,
    isStale,
    error,
    staleReason,
    lastUpdated,
    selectedCamera,
    setSelectedCamera,
    refreshState,
    refresh,
  };
}

export default useCameraData;
