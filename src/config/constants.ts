/**
 * Application constants for Godseye Holborn
 * Centralized configuration values to avoid magic numbers
 */

// Animation configuration
export const ANIMATION_DURATION_MS = 7000;

export const ANIMATION_PHASES = {
  space: 0.3,
  uk: 0.55,
  london: 0.8,
  city: 1.0,
} as const;

// Geographic constants
export const CRIME_SEARCH_RADIUS_M = 1000; // 1km radius for crime searches

// Polling intervals (in milliseconds)
export const DEFAULT_POLL_INTERVAL_MS = 60000; // 60 seconds
export const MIN_POLL_INTERVAL_MS = 60000; // Minimum 60 seconds

// Override with environment variables if available
export const CRIME_POLL_INTERVAL_MS = 
  Math.max(
    parseInt(import.meta.env.VITE_CRIME_POLL_INTERVAL_MS || '60000', 10),
    MIN_POLL_INTERVAL_MS
  );

export const CAMERA_POLL_INTERVAL_MS = 
  Math.max(
    parseInt(import.meta.env.VITE_CAMERA_POLL_INTERVAL_MS || '60000', 10),
    MIN_POLL_INTERVAL_MS
  );

// UI constants
export const SIDEBAR_COLLAPSED_WIDTH_PX = 56;
export const SIDEBAR_EXPANDED_WIDTH_PX = 240;
export const NAVBAR_HEIGHT_PX = 48;
export const PANEL_MAX_HEIGHT_VH = 40; // 40% of viewport height

// Map configuration
export const DEFAULT_MAP_ZOOM = 13;
export const MARKER_CLUSTER_RADIUS = 50;

// Camera status check interval
export const CAMERA_STATUS_CHECK_INTERVAL_MS = 10000; // 10 seconds

// Stale data threshold (missed polls before showing warning)
export const STALE_THRESHOLD_MISSED_POLLS = 2;
