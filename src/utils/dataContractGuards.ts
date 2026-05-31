import type { CameraSource, Crime, CrimeCategory } from '@/types';

const CAMERA_TYPES = new Set(['traffic', 'security', 'public']);
const CAMERA_PROVIDERS = new Set(['tfl', 'opendata']);
const CAMERA_STATUSES = new Set(['active', 'inactive', 'unknown']);
const CAMERA_FEED_TYPES = new Set(['snapshot']);

const CRIME_CATEGORIES = new Set([
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
]);

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export interface SanitizedPayloadResult<T> {
  valid: T[];
  invalidCount: number;
  errors: string[];
}

export type CameraPayloadCandidate = Record<string, unknown>;
export type CrimePayloadCandidate = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function validateCameraCandidate(candidate: CameraPayloadCandidate): string[] {
  const errors: string[] = [];

  if (!isString(candidate.id) || candidate.id.trim() === '') {
    errors.push('id');
  }
  if (!isString(candidate.name) || candidate.name.trim() === '') {
    errors.push('name');
  }
  if (!isString(candidate.type) || !CAMERA_TYPES.has(candidate.type)) {
    errors.push('type');
  }
  if (!isString(candidate.provider) || !CAMERA_PROVIDERS.has(candidate.provider)) {
    errors.push('provider');
  }
  if (!isString(candidate.streamUrl) || candidate.streamUrl.trim() === '') {
    errors.push('streamUrl');
  }
  if (!isString(candidate.status) || !CAMERA_STATUSES.has(candidate.status)) {
    errors.push('status');
  }
  if (!isString(candidate.lastVerified)) {
    errors.push('lastVerified');
  }
  if (!isString(candidate.feedType) || !CAMERA_FEED_TYPES.has(candidate.feedType)) {
    errors.push('feedType');
  }

  if (!isObject(candidate.coordinates)) {
    errors.push('coordinates');
  } else {
    if (!isFiniteNumber(candidate.coordinates.lat)) errors.push('coordinates.lat');
    if (!isFiniteNumber(candidate.coordinates.lng)) errors.push('coordinates.lng');
  }

  return errors;
}

function validateCrimeCandidate(candidate: CrimePayloadCandidate): string[] {
  const errors: string[] = [];

  if (!isString(candidate.id) || candidate.id.trim() === '') {
    errors.push('id');
  }
  if (!isString(candidate.category) || !CRIME_CATEGORIES.has(candidate.category)) {
    errors.push('category');
  }
  if (!isString(candidate.month) || !MONTH_PATTERN.test(candidate.month)) {
    errors.push('month');
  }

  if (!isObject(candidate.location)) {
    errors.push('location');
  } else {
    if (!isFiniteNumber(candidate.location.lat)) errors.push('location.lat');
    if (!isFiniteNumber(candidate.location.lng)) errors.push('location.lng');
  }

  if (!isObject(candidate.street)) {
    errors.push('street');
  } else {
    const streetId = candidate.street.id;
    if (!(typeof streetId === 'string' || typeof streetId === 'number')) {
      errors.push('street.id');
    }
    if (!isString(candidate.street.name) || candidate.street.name.trim() === '') {
      errors.push('street.name');
    }
  }

  return errors;
}

export function sanitizeCameraPayload(payload: unknown): SanitizedPayloadResult<CameraSource> {
  if (!Array.isArray(payload)) {
    return {
      valid: [],
      invalidCount: 1,
      errors: ['root: expected array payload'],
    };
  }

  const valid: CameraSource[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  payload.forEach((raw, index) => {
    if (!isObject(raw)) {
      invalidCount += 1;
      errors.push(`row ${index}: not an object`);
      return;
    }
    const issues = validateCameraCandidate(raw);
    if (issues.length > 0) {
      invalidCount += 1;
      errors.push(`row ${index}: ${issues.join(', ')}`);
      return;
    }
    valid.push(raw as unknown as CameraSource);
  });

  return {
    valid,
    invalidCount,
    errors,
  };
}

export function sanitizeCrimePayload(payload: unknown): SanitizedPayloadResult<Crime> {
  if (!Array.isArray(payload)) {
    return {
      valid: [],
      invalidCount: 1,
      errors: ['root: expected array payload'],
    };
  }

  const valid: Crime[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  payload.forEach((raw, index) => {
    if (!isObject(raw)) {
      invalidCount += 1;
      errors.push(`row ${index}: not an object`);
      return;
    }
    const issues = validateCrimeCandidate(raw);
    if (issues.length > 0) {
      invalidCount += 1;
      errors.push(`row ${index}: ${issues.join(', ')}`);
      return;
    }
    valid.push({
      id: raw.id as string,
      category: raw.category as CrimeCategory,
      location: {
        lat: (raw.location as Record<string, unknown>).lat as number,
        lng: (raw.location as Record<string, unknown>).lng as number,
      },
      street: {
        id: (raw.street as Record<string, unknown>).id as string | number,
        name: (raw.street as Record<string, unknown>).name as string,
      },
      context: raw.context as string | undefined,
      outcomeStatus: raw.outcomeStatus as string | undefined,
      persistentId: raw.persistentId as string | undefined,
      month: raw.month as string,
      date: raw.date as Date | undefined,
    });
  });

  return {
    valid,
    invalidCount,
    errors,
  };
}
