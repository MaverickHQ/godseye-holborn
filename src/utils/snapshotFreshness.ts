export type SnapshotFreshnessStatus = 'fresh' | 'aging' | 'stale' | 'unavailable';

export type SnapshotFreshnessReason =
  | 'ok'
  | 'source_too_old'
  | 'source_timestamp_missing'
  | 'source_timestamp_invalid'
  | 'clock_skew_exceeded'
  | 'fetch_failures'
  | 'stream_url_missing';

export interface SnapshotFreshnessPolicy {
  freshMs: number;
  agingMs: number;
  staleMs: number;
  clockSkewToleranceMs: number;
  staleAfterFailures: number;
}

export interface SnapshotFreshnessInput {
  sourceTimestamp: string | null | undefined;
  observedAt: Date;
  failureCount: number;
  hasStreamUrl: boolean;
  policy?: SnapshotFreshnessPolicy;
}

export interface SnapshotFreshnessResult {
  status: SnapshotFreshnessStatus;
  reason: SnapshotFreshnessReason;
  ageMs: number | null;
  sourceTimestamp: string | null;
  observedAt: string;
  failureCount: number;
  skewAdjusted: boolean;
}

export const DEFAULT_SNAPSHOT_FRESHNESS_POLICY: SnapshotFreshnessPolicy = {
  // Tune defaults for snapshot-only camera sources where upstream timestamp cadence is bursty.
  freshMs: 600_000,
  agingMs: 1_800_000,
  staleMs: 5_400_000,
  clockSkewToleranceMs: 60_000,
  staleAfterFailures: 2,
};

function parseSourceTimestamp(raw: string): Date | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const withT = normalized.replace(' ', 'T');
  const maybeUtc = /Z|[+-]\d{2}:?\d{2}$/.test(withT) ? withT : `${withT}Z`;
  const fallback = new Date(maybeUtc);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

export function assessSnapshotFreshness(input: SnapshotFreshnessInput): SnapshotFreshnessResult {
  const policy = input.policy ?? DEFAULT_SNAPSHOT_FRESHNESS_POLICY;
  const observedAtIso = input.observedAt.toISOString();

  if (!input.hasStreamUrl) {
    return {
      status: 'unavailable',
      reason: 'stream_url_missing',
      ageMs: null,
      sourceTimestamp: null,
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted: false,
    };
  }

  const sourceRaw = input.sourceTimestamp ?? '';
  if (!sourceRaw.trim()) {
    return {
      status: 'unavailable',
      reason: 'source_timestamp_missing',
      ageMs: null,
      sourceTimestamp: null,
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted: false,
    };
  }

  const parsed = parseSourceTimestamp(sourceRaw);
  if (!parsed) {
    return {
      status: 'unavailable',
      reason: 'source_timestamp_invalid',
      ageMs: null,
      sourceTimestamp: sourceRaw,
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted: false,
    };
  }

  let ageMs = input.observedAt.getTime() - parsed.getTime();
  let skewAdjusted = false;

  if (ageMs < 0) {
    if (Math.abs(ageMs) <= policy.clockSkewToleranceMs) {
      ageMs = 0;
      skewAdjusted = true;
    } else {
      return {
        status: 'unavailable',
        reason: 'clock_skew_exceeded',
        ageMs,
        sourceTimestamp: parsed.toISOString(),
        observedAt: observedAtIso,
        failureCount: input.failureCount,
        skewAdjusted: false,
      };
    }
  }

  if (input.failureCount >= policy.staleAfterFailures) {
    return {
      status: 'stale',
      reason: 'fetch_failures',
      ageMs,
      sourceTimestamp: parsed.toISOString(),
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted,
    };
  }

  if (ageMs <= policy.freshMs) {
    return {
      status: 'fresh',
      reason: 'ok',
      ageMs,
      sourceTimestamp: parsed.toISOString(),
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted,
    };
  }

  if (ageMs <= policy.staleMs) {
    return {
      status: 'aging',
      reason: 'ok',
      ageMs,
      sourceTimestamp: parsed.toISOString(),
      observedAt: observedAtIso,
      failureCount: input.failureCount,
      skewAdjusted,
    };
  }

  return {
    status: 'stale',
    reason: 'source_too_old',
    ageMs,
    sourceTimestamp: parsed.toISOString(),
    observedAt: observedAtIso,
    failureCount: input.failureCount,
    skewAdjusted,
  };
}

export default {
  assessSnapshotFreshness,
  DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
};
