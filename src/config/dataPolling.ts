/// <reference types="vite/client" />

// Data polling configuration
// These can be overridden via environment variables for testing or production optimization
// Import from constants.ts for core values

import {
  CRIME_POLL_INTERVAL_MS,
  CAMERA_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
} from './constants';

// Stale data threshold: time after which data is considered stale
// (typically 2x the poll interval)
export const STALE_THRESHOLD_MULTIPLIER = 2;

export function getCrimePollInterval(): number {
  return Math.max(CRIME_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS);
}

export function getCameraPollInterval(): number {
  return Math.max(CAMERA_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS);
}

export default {
  CRIME_POLL_INTERVAL_MS,
  CAMERA_POLL_INTERVAL_MS,
  STALE_THRESHOLD_MULTIPLIER,
  getCrimePollInterval,
  getCameraPollInterval,
};
