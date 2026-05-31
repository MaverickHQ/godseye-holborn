export type StorageTier = 'hot' | 'archive';

export interface RetentionOptions {
  asOf: Date;
  hotWindowDays?: number;
}

export interface RetentionTaggedRecord {
  [key: string]: unknown;
  event_date: string;
  storage_tier: StorageTier;
  archive_eligible_after: string;
  archive_access_mode: 'none' | 'offline-analysis-only';
}

export interface RetentionResult {
  records: RetentionTaggedRecord[];
  hotCount: number;
  archiveCount: number;
}

export interface ArchiveLifecycleRule {
  id: string;
  prefix: string;
  transitionAfterDays: number;
  archiveStorageClass: string;
  archiveAccessMode: 'offline-analysis-only';
}

export interface ArchiveLifecyclePolicy {
  bucketName: string;
  rules: ArchiveLifecycleRule[];
}

export interface ArchiveLifecyclePolicyInput {
  bucketName: string;
  tablePrefixes: string[];
  transitionAfterDays?: number;
  archiveStorageClass?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_HOT_WINDOW_DAYS = 90;

function parseIsoDate(dateYyyyMmDd: string): Date {
  const parsed = new Date(`${dateYyyyMmDd}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid event_date: ${dateYyyyMmDd}`);
  }
  return parsed;
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function diffDaysUtc(eventDate: Date, asOf: Date): number {
  const eventMidnight = parseIsoDate(formatDateUtc(eventDate));
  const asOfMidnight = parseIsoDate(formatDateUtc(asOf));
  return Math.floor((asOfMidnight.getTime() - eventMidnight.getTime()) / MS_PER_DAY);
}

function addDays(dateYyyyMmDd: string, days: number): string {
  const date = parseIsoDate(dateYyyyMmDd);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateUtc(date);
}

export function classifyStorageTier(
  eventDateYyyyMmDd: string,
  asOf: Date,
  hotWindowDays = DEFAULT_HOT_WINDOW_DAYS,
): StorageTier {
  const ageInDays = diffDaysUtc(parseIsoDate(eventDateYyyyMmDd), asOf);
  return ageInDays <= hotWindowDays ? 'hot' : 'archive';
}

export function applyHotWindowRetention<T extends { event_date: string }>(
  records: T[],
  options: RetentionOptions,
): RetentionResult {
  const hotWindowDays = options.hotWindowDays ?? DEFAULT_HOT_WINDOW_DAYS;
  let hotCount = 0;
  let archiveCount = 0;

  const taggedRecords: RetentionTaggedRecord[] = records.map(record => {
    const tier = classifyStorageTier(record.event_date, options.asOf, hotWindowDays);
    if (tier === 'hot') {
      hotCount += 1;
    } else {
      archiveCount += 1;
    }

    return {
      ...record,
      storage_tier: tier,
      archive_eligible_after: addDays(record.event_date, hotWindowDays),
      archive_access_mode: tier === 'archive' ? 'offline-analysis-only' : 'none',
    };
  });

  return {
    records: taggedRecords,
    hotCount,
    archiveCount,
  };
}

export function buildArchiveLifecyclePolicy(
  input: ArchiveLifecyclePolicyInput,
): ArchiveLifecyclePolicy {
  const transitionAfterDays = input.transitionAfterDays ?? DEFAULT_HOT_WINDOW_DAYS + 1;
  const archiveStorageClass = input.archiveStorageClass ?? 'GLACIER';

  const rules = input.tablePrefixes.map((prefix, index) => ({
    id: `archive-rule-${index + 1}-${prefix.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`,
    prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
    transitionAfterDays,
    archiveStorageClass,
    archiveAccessMode: 'offline-analysis-only' as const,
  }));

  return {
    bucketName: input.bucketName,
    rules,
  };
}

export default {
  classifyStorageTier,
  applyHotWindowRetention,
  buildArchiveLifecyclePolicy,
};
