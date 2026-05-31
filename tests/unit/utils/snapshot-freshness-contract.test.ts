import { describe, expect, it } from 'vitest';
import {
  assessSnapshotFreshness,
  DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
} from '@/utils/snapshotFreshness';

describe('snapshot freshness contract', () => {
  const observedAt = new Date('2026-05-25T12:00:00.000Z');

  it('classifies fresh, aging, and stale windows from source timestamp age', () => {
    const fresh = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T11:59:20.000Z',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        freshMs: 120_000,
        agingMs: 240_000,
        staleMs: 600_000,
      },
    });

    const aging = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T11:56:30.000Z',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        freshMs: 120_000,
        agingMs: 240_000,
        staleMs: 600_000,
      },
    });

    const stale = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T11:45:00.000Z',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        freshMs: 120_000,
        agingMs: 240_000,
        staleMs: 600_000,
      },
    });

    expect(fresh.status).toBe('fresh');
    expect(aging.status).toBe('aging');
    expect(stale.status).toBe('stale');
    expect(stale.reason).toBe('source_too_old');
  });

  it('normalizes parseable timestamp formats and guards invalid/missing source timestamps', () => {
    const normalized = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25 11:59:30',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
    });

    const missing = assessSnapshotFreshness({
      sourceTimestamp: '',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
    });

    const invalid = assessSnapshotFreshness({
      sourceTimestamp: 'not-a-date',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
    });

    expect(normalized.status).not.toBe('unavailable');
    expect(missing.status).toBe('unavailable');
    expect(missing.reason).toBe('source_timestamp_missing');
    expect(invalid.status).toBe('unavailable');
    expect(invalid.reason).toBe('source_timestamp_invalid');
  });

  it('applies clock-skew tolerance and explicit fetch-failure stale criteria', () => {
    const skewTolerated = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T12:00:45.000Z',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        clockSkewToleranceMs: 60_000,
      },
    });

    const skewRejected = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T12:03:30.000Z',
      observedAt,
      failureCount: 0,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        clockSkewToleranceMs: 60_000,
      },
    });

    const failed = assessSnapshotFreshness({
      sourceTimestamp: '2026-05-25T11:59:30.000Z',
      observedAt,
      failureCount: 3,
      hasStreamUrl: true,
      policy: {
        ...DEFAULT_SNAPSHOT_FRESHNESS_POLICY,
        staleAfterFailures: 2,
      },
    });

    expect(skewTolerated.status).toBe('fresh');
    expect(skewTolerated.skewAdjusted).toBe(true);
    expect(skewRejected.status).toBe('unavailable');
    expect(skewRejected.reason).toBe('clock_skew_exceeded');

    expect(failed.status).toBe('stale');
    expect(failed.reason).toBe('fetch_failures');
  });
});
