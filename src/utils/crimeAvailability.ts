export type CrimeAvailabilityState =
  | 'available'
  | 'no_publication'
  | 'future_month'
  | 'source_outage'
  | 'schema_drift';

export interface CrimeAvailability {
  state: CrimeAvailabilityState;
  message: string;
}

const DEFAULT_MESSAGES: Record<CrimeAvailabilityState, string> = {
  available: 'Crime source healthy',
  no_publication: 'No published crime data found in configured lookback window',
  future_month: 'Future-dated publication detected; treating source as degraded',
  source_outage: 'Crime source outage detected',
  schema_drift: 'Crime payload schema drift detected',
};

function toUtcMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isFutureCrimeMonth(month: string | null | undefined, now: Date = new Date()): boolean {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return false;
  return month.localeCompare(toUtcMonth(now)) > 0;
}

export function createCrimeAvailability(
  state: CrimeAvailabilityState,
  message?: string,
): CrimeAvailability {
  return {
    state,
    message: message?.trim() || DEFAULT_MESSAGES[state],
  };
}
