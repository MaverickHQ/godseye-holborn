/// <reference types="vite/client" />

import axios from 'axios';
import type { Crime, CrimeCategory } from '@/types';
import { CRIME_SEARCH_RADIUS_M } from '@/config/constants';

const POLICE_API_BASE = 'https://data.police.uk/api';
const CRIME_LOOKBACK_MAX_MONTHS = Math.max(
  parseInt(import.meta.env.VITE_CRIME_LOOKBACK_MAX_MONTHS || '12', 10),
  3,
);

// Target area: Holborn, London
const TARGET_LAT = 51.5185;
const TARGET_LNG = -0.1065;

// Crime category colors for UI
export const CRIME_CATEGORY_COLORS: Record<CrimeCategory, string> = {
  'anti-social-behaviour': '#6B7280',
  'bicycle-theft': '#10B981',
  'burglary': '#8B5CF6',
  'criminal-damage-arson': '#F59E0B',
  'drugs': '#EF4444',
  'other-crime': '#6366F1',
  'other-theft': '#14B8A6',
  'possession-of-weapons': '#DC2626',
  'public-order': '#F97316',
  'robbery': '#A855F7',
  'shoplifting': '#22C55E',
  'theft-from-the-person': '#EAB308',
  'vehicle-crime': '#3B82F6',
  'violent-crime': '#EC4899',
};

// Crime category display names
export const CRIME_CATEGORY_LABELS: Record<CrimeCategory, string> = {
  'anti-social-behaviour': 'Anti-Social Behaviour',
  'bicycle-theft': 'Bicycle Theft',
  'burglary': 'Burglary',
  'criminal-damage-arson': 'Criminal Damage',
  'drugs': 'Drugs',
  'other-crime': 'Other Crime',
  'other-theft': 'Other Theft',
  'possession-of-weapons': 'Weapons',
  'public-order': 'Public Order',
  'robbery': 'Robbery',
  'shoplifting': 'Shoplifting',
  'theft-from-the-person': 'Theft from Person',
  'vehicle-crime': 'Vehicle Crime',
  'violent-crime': 'Violent Crime',
};

// All crime categories
export const ALL_CRIME_CATEGORIES: CrimeCategory[] = [
  'anti-social-behaviour',
  'bicycle-theft',
  'burglary',
  'criminal-damage-arson',
  'drugs',
  'other-crime',
  'other-theft',
  'possession-of-weapons',
  'public-order',
  'robbery',
  'shoplifting',
  'theft-from-the-person',
  'vehicle-crime',
  'violent-crime',
];

// Police UK API response types
interface PoliceCrimeResponse {
  id?: number;
  category: string;
  location_type: string;
  location_subtype: string;
  month: string;
  outcome_status?: {
    category: string;
    date: string;
  } | null;
  context?: string;
  persistent_id?: string;
  location: {
    latitude: string;
    longitude: string;
    street: {
      id: number;
      name: string;
    };
  };
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'upstream request failed';
}

// Fetch crimes at a specific location
export async function getCrimesAtLocation(
  lat: number = TARGET_LAT,
  lng: number = TARGET_LNG,
  date?: string
): Promise<Crime[]> {
  try {
    const params: Record<string, string | number> = { lat, lng };
    if (date) {
      params.date = date;
    }

    const response = await axios.get<PoliceCrimeResponse[]>(
      `${POLICE_API_BASE}/crimes-at-location`,
      { params }
    );

    return response.data.map((crime, index) => ({
      id: crime.id?.toString() || `crime-${index}`,
      category: crime.category as CrimeCategory,
      location: {
        lat: parseFloat(crime.location.latitude),
        lng: parseFloat(crime.location.longitude),
      },
      street: crime.location.street,
      context: crime.context,
      outcomeStatus: crime.outcome_status?.category,
      persistentId: crime.persistent_id,
      month: crime.month,
      date: crime.month ? new Date(crime.month) : undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch crimes at location:', error);
    return [];
  }
}

// Fetch crimes within a radius of a point
export async function getCrimesOnStreet(
  lat: number = TARGET_LAT,
  lng: number = TARGET_LNG,
  date?: string,
  radius: number = 500,
  options: { throwOnError?: boolean } = {},
): Promise<Crime[]> {
  try {
    const params: Record<string, string | number> = {
      lat,
      lng,
      radius,
    };
    if (date) {
      params.date = date;
    }

    const response = await axios.get<PoliceCrimeResponse[]>(
      `${POLICE_API_BASE}/crimes-street/all-crime`,
      { params }
    );

    return response.data.map((crime, index) => ({
      id: crime.id?.toString() || `crime-${index}`,
      category: crime.category as CrimeCategory,
      location: {
        lat: parseFloat(crime.location.latitude),
        lng: parseFloat(crime.location.longitude),
      },
      street: crime.location.street,
      context: crime.context,
      outcomeStatus: crime.outcome_status?.category,
      persistentId: crime.persistent_id,
      month: crime.month,
      date: crime.month ? new Date(crime.month) : undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch crimes on street:', error);
    if (options.throwOnError) {
      throw new Error(`Crime source outage: ${normalizeErrorMessage(error)}`);
    }
    return [];
  }
}

// Fetch crimes in the Holborn area (within 1km)
export async function getCrimesInHolborn(
  months: number = 3,
  radiusMeters: number = CRIME_SEARCH_RADIUS_M,
): Promise<Crime[]> {
  // Get crimes for the last N non-empty publication months.
  // If recent months are empty due publication lag, keep rolling backwards
  // within a bounded lookback window until data is found.
  const targetNonEmptyMonths = Math.max(1, months);
  const maxLookbackMonths = Math.max(CRIME_LOOKBACK_MAX_MONTHS, targetNonEmptyMonths);
  const allCrimes: Crime[] = [];
  const nonEmptyMonths = new Set<string>();
  const now = new Date();
  let successfulLookups = 0;
  let failedLookups = 0;
  let lastFailureMessage: string | null = null;

  for (let i = 0; i < maxLookbackMonths; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let monthCrimes: Crime[] = [];
    try {
      monthCrimes = await getCrimesOnStreet(TARGET_LAT, TARGET_LNG, dateStr, radiusMeters, {
        throwOnError: true,
      });
      successfulLookups += 1;
    } catch (error) {
      failedLookups += 1;
      lastFailureMessage = normalizeErrorMessage(error);
      continue;
    }

    if (monthCrimes.length === 0) {
      continue;
    }

    nonEmptyMonths.add(dateStr);
    allCrimes.push(...monthCrimes);

    if (nonEmptyMonths.size >= targetNonEmptyMonths) {
      break;
    }
  }

  if (allCrimes.length === 0 && successfulLookups === 0 && failedLookups > 0) {
    throw new Error(`Crime source outage: ${lastFailureMessage || 'all publication lookups failed'}`);
  }

  // Remove duplicates using persistent ID when present, with stable fallback key
  const seen = new Set<string>();
  const uniqueCrimes: Crime[] = [];
  for (const crime of allCrimes) {
    const dedupeKey =
      crime.persistentId?.trim() ||
      `${crime.id}|${crime.month}|${crime.category}|${crime.street?.id ?? ''}|${crime.location.lat}|${crime.location.lng}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    uniqueCrimes.push(crime);
  }

  return uniqueCrimes;
}

// Get crime categories with counts
export function getCrimesByCategory(crimes: Crime[]): Record<CrimeCategory, number> {
  const counts: Record<string, number> = {};
  
  for (const crime of crimes) {
    counts[crime.category] = (counts[crime.category] || 0) + 1;
  }
  
  return counts as Record<CrimeCategory, number>;
}

// Get crimes by month
export function getCrimesByMonth(crimes: Crime[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const crime of crimes) {
    counts[crime.month] = (counts[crime.month] || 0) + 1;
  }
  
  // Sort by month
  const sortedCounts: Record<string, number> = {};
  Object.keys(counts)
    .sort()
    .forEach(key => {
      sortedCounts[key] = counts[key];
    });
  
  return sortedCounts;
}

// Get crime outcomes
export function getCrimeOutcomes(crimes: Crime[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const crime of crimes) {
    if (crime.outcomeStatus) {
      counts[crime.outcomeStatus] = (counts[crime.outcomeStatus] || 0) + 1;
    } else {
      counts['Under investigation'] = (counts['Under investigation'] || 0) + 1;
    }
  }
  
  return counts;
}

// Fetch crime categories from API
export async function getCrimeCategories(): Promise<string[]> {
  try {
    const response = await axios.get<string[]>(
      `${POLICE_API_BASE}/crime-categories`
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch crime categories:', error);
    return ALL_CRIME_CATEGORIES;
  }
}

// Fetch last updated date for crime data
export async function getLastUpdatedDate(): Promise<string | null> {
  try {
    // Get current month crime data to find the latest update
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const crimes = await getCrimesOnStreet(TARGET_LAT, TARGET_LNG, dateStr, 100);
    
    if (crimes.length > 0) {
      return dateStr;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get last updated date:', error);
    return null;
  }
}

export default {
  getCrimesAtLocation,
  getCrimesOnStreet,
  getCrimesInHolborn,
  getCrimesByCategory,
  getCrimesByMonth,
  getCrimeOutcomes,
  getCrimeCategories,
  getLastUpdatedDate,
  CRIME_CATEGORY_COLORS,
  CRIME_CATEGORY_LABELS,
  ALL_CRIME_CATEGORIES,
};
