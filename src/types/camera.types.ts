// Camera types
import type { Coordinates } from './coordinates.types';

export type CameraProvider = 'tfl' | 'opendata';
export type CameraType = 'traffic' | 'security' | 'public';
export type CameraStatus = 'active' | 'inactive' | 'unknown';
export type StreamStatus = 'snapshot' | 'snapshot-aged' | 'stale' | 'offline' | 'loading' | 'error';

export interface CameraSource {
  id: string;
  name: string;
  type: CameraType;
  provider: CameraProvider;
  coordinates: Coordinates;
  streamUrl: string;
  status: CameraStatus;
  // Snapshot capture timestamp reported by upstream source.
  lastVerified: string;
  // Proxy/list fetch heartbeat used for runtime freshness evaluation.
  sourceCheckedAt?: string;
  // Feed type is locked to snapshot-only for TfL JamCam sources.
  feedType: 'snapshot';
  // Extended properties for enhanced cameras
  alternateUrls?: string[];
  ip?: string;
  port?: number;
  isp?: string;
  org?: string;
  screenshot?: string | null;
}
