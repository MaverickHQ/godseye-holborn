interface CrimeLastUpdatedResponse {
  date: string;
}

interface CrimeStreetDateResponse {
  date: string;
}

export interface CrimePublicationCadence {
  dataCurrentThroughMonth: string | null;
  nextExpectedReleaseWindow: string;
  lagMonths: number | null;
  sourceLagCaveat: string;
  checkedAt: string;
}

export interface CrimeCadenceDependencies {
  fetchLastUpdated?: () => Promise<CrimeLastUpdatedResponse>;
  fetchAvailableMonths?: () => Promise<CrimeStreetDateResponse[]>;
  now?: () => Date;
}

const POLICE_LAST_UPDATED_URL = 'https://data.police.uk/api/crime-last-updated';
const POLICE_AVAILABLE_MONTHS_URL = 'https://data.police.uk/api/crimes-street-dates';
const CADENCE_CAVEAT =
  'Police UK street-level crime data is published monthly and may lag by several weeks.';

function parseMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const asMonth = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (asMonth) {
    return `${asMonth[1]}-${asMonth[2]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(yyyyMm: string, offset: number): string {
  const [yearRaw, monthRaw] = yyyyMm.split('-');
  const base = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + offset);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(yyyyMm: string): string {
  const [yearRaw, monthRaw] = yyyyMm.split('-');
  const date = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function monthDiff(fromYyyyMm: string, toYyyyMm: string): number {
  const [fromYear, fromMonth] = fromYyyyMm.split('-').map(Number);
  const [toYear, toMonth] = toYyyyMm.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function defaultFetchLastUpdated(): Promise<CrimeLastUpdatedResponse> {
  return fetchJson<CrimeLastUpdatedResponse>(POLICE_LAST_UPDATED_URL);
}

async function defaultFetchAvailableMonths(): Promise<CrimeStreetDateResponse[]> {
  return fetchJson<CrimeStreetDateResponse[]>(POLICE_AVAILABLE_MONTHS_URL);
}

function buildFallbackCadence(now: Date): CrimePublicationCadence {
  return {
    dataCurrentThroughMonth: null,
    nextExpectedReleaseWindow: 'Unavailable (source check failed)',
    lagMonths: null,
    sourceLagCaveat: CADENCE_CAVEAT,
    checkedAt: now.toISOString(),
  };
}

export async function resolveCrimePublicationCadence(
  dependencies: CrimeCadenceDependencies = {},
): Promise<CrimePublicationCadence> {
  const fetchLastUpdated = dependencies.fetchLastUpdated ?? defaultFetchLastUpdated;
  const fetchAvailableMonths = dependencies.fetchAvailableMonths ?? defaultFetchAvailableMonths;
  const now = dependencies.now?.() ?? new Date();
  const nowMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  try {
    const [lastUpdated, available] = await Promise.all([fetchLastUpdated(), fetchAvailableMonths()]);

    const monthFromLastUpdated = parseMonth(lastUpdated.date);
    const availableMonths = available
      .map(item => parseMonth(item.date))
      .filter((month): month is string => Boolean(month))
      .sort((a, b) => b.localeCompare(a));

    const latestAvailableMonth = availableMonths[0] ?? null;
    const dataCurrentThroughMonth =
      monthFromLastUpdated && latestAvailableMonth
        ? monthFromLastUpdated.localeCompare(latestAvailableMonth) >= 0
          ? monthFromLastUpdated
          : latestAvailableMonth
        : monthFromLastUpdated ?? latestAvailableMonth;

    if (!dataCurrentThroughMonth) {
      return buildFallbackCadence(now);
    }

    const lagMonths = Math.max(0, monthDiff(dataCurrentThroughMonth, nowMonth));
    const nextMonth = addMonths(dataCurrentThroughMonth, 1);
    const releaseWindow =
      lagMonths === 0
        ? `${formatMonthLabel(dataCurrentThroughMonth)} available now`
        : `Late ${formatMonthLabel(nextMonth)} to early ${formatMonthLabel(addMonths(nextMonth, 1))}`;

    return {
      dataCurrentThroughMonth,
      nextExpectedReleaseWindow: releaseWindow,
      lagMonths,
      sourceLagCaveat: CADENCE_CAVEAT,
      checkedAt: now.toISOString(),
    };
  } catch {
    return buildFallbackCadence(now);
  }
}

export default {
  resolveCrimePublicationCadence,
};
