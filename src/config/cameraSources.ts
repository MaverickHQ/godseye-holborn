import type { CameraSource } from '@/types';

// Camera sources in the Holborn area, London
// Coordinates: 51.5185° N, 0.1065° W

export const TARGET_LOCATION = {
  name: 'Holborn',
  address: 'Holborn, London EC1',
  lat: 51.5185,
  lng: -0.1065,
  altitude: 30, // meters above sea level
} as const;

// Bounding box for camera/crime search (~1km radius)
export const BOUNDING_BOX = {
  north: 51.5250,
  south: 51.5120,
  east: -0.0950,
  west: -0.1180,
} as const;

// TfL Traffic Cameras in the Holborn area
// Note: TfL provides snapshot images (refreshed ~30s), not live video streams
// The feedType field indicates this honestly
export const CAMERA_SOURCES: CameraSource[] = [
  {
    id: 'JamCams_00001.03608',
    name: 'Farringdon Rd/Cowcross St',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5200, lng: -0.1059 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03608.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot', // TfL provides still images, not live video
  },
  {
    id: 'JamCams_00001.03600',
    name: 'Farringdon Rd opp Ray St',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5232, lng: -0.1079 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03600.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot',
  },
  {
    id: 'JamCams_00001.01551',
    name: 'Rosebery Av/Mount Pleasant',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5246, lng: -0.1110 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01551.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot',
  },
  {
    id: 'JamCams_00001.07591',
    name: 'Theobalds Rd/Boswell St',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5196, lng: -0.1202 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07591.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot',
  },
  {
    id: 'JamCams_00001.07600',
    name: 'Kingsway/High Holborn',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5165, lng: -0.1168 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07600.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot',
  },
  {
    id: 'JamCams_00001.03591',
    name: 'Kings X Rd / Swinton St',
    type: 'traffic',
    provider: 'tfl',
    coordinates: { lat: 51.5274, lng: -0.1124 },
    streamUrl: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03591.jpg',
    status: 'unknown',
    lastVerified: '',
    feedType: 'snapshot',
  },
];

export default {
  TARGET_LOCATION,
  BOUNDING_BOX,
  CAMERA_SOURCES,
};
