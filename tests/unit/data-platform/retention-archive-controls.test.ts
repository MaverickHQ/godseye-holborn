import { describe, expect, it } from 'vitest';
import {
  applyHotWindowRetention,
  buildArchiveLifecyclePolicy,
  classifyStorageTier,
} from '@/dataPlatform/retention';

describe('phase 2.2 retention and archive controls', () => {
  it('keeps records within 90 days in hot tier and marks older records for archive', () => {
    const asOf = new Date('2026-05-24T00:00:00.000Z');

    expect(classifyStorageTier('2026-05-24', asOf)).toBe('hot');
    expect(classifyStorageTier('2026-02-23', asOf)).toBe('hot'); // exactly 90 days old
    expect(classifyStorageTier('2026-02-22', asOf)).toBe('archive'); // 91 days old
  });

  it('applies retention tags and archive eligibility metadata deterministically', () => {
    const asOf = new Date('2026-05-24T00:00:00.000Z');
    const result = applyHotWindowRetention(
      [
        { id: 'recent', event_date: '2026-05-20', area: 'holborn' },
        { id: 'old', event_date: '2026-01-20', area: 'holborn' },
      ],
      { asOf },
    );

    expect(result.hotCount).toBe(1);
    expect(result.archiveCount).toBe(1);
    expect(result.records[0]).toMatchObject({
      id: 'recent',
      storage_tier: 'hot',
      archive_access_mode: 'none',
    });
    expect(result.records[1]).toMatchObject({
      id: 'old',
      storage_tier: 'archive',
      archive_access_mode: 'offline-analysis-only',
    });
    expect(result.records[1].archive_eligible_after).toBe('2026-04-20');
  });

  it('builds lifecycle rules that transition data older than 90 days to archive class', () => {
    const lifecycle = buildArchiveLifecyclePolicy({
      bucketName: 'godseye-holborn-data',
      tablePrefixes: ['curated/', 'feature/', 'prediction/', 'evaluation/', 'serving/'],
      transitionAfterDays: 91,
      archiveStorageClass: 'GLACIER',
    });

    expect(lifecycle.bucketName).toBe('godseye-holborn-data');
    expect(lifecycle.rules).toHaveLength(5);
    for (const rule of lifecycle.rules) {
      expect(rule.transitionAfterDays).toBe(91);
      expect(rule.archiveStorageClass).toBe('GLACIER');
      expect(rule.archiveAccessMode).toBe('offline-analysis-only');
      expect(rule.prefix.endsWith('/')).toBe(true);
    }
  });
});
