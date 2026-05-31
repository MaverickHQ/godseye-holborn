import { describe, expect, it } from 'vitest';
import {
  sanitizeCameraPayload,
  sanitizeCrimePayload,
  type CameraPayloadCandidate,
  type CrimePayloadCandidate,
} from '@/utils/dataContractGuards';

describe('data contract guards', () => {
  it('filters invalid camera payload entries and reports drift diagnostics', () => {
    const payload: CameraPayloadCandidate[] = [
      {
        id: 'cam-1',
        name: 'Valid camera',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.52, lng: -0.1059 },
        streamUrl: 'https://example.com/cam-1.jpg',
        status: 'active',
        lastVerified: '2026-05-25T10:00:00Z',
        feedType: 'snapshot',
      },
      {
        id: 'cam-2',
        name: 'Missing stream url',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: 51.5201, lng: -0.1060 },
        status: 'active',
        lastVerified: '2026-05-25T10:00:00Z',
        feedType: 'snapshot',
      },
      {
        id: 'cam-3',
        name: 'Invalid coordinates',
        type: 'traffic',
        provider: 'tfl',
        coordinates: { lat: Number.NaN, lng: -0.1061 },
        streamUrl: 'https://example.com/cam-3.jpg',
        status: 'active',
        lastVerified: '2026-05-25T10:00:00Z',
        feedType: 'snapshot',
      },
    ];

    const result = sanitizeCameraPayload(payload);
    expect(result.valid).toHaveLength(1);
    expect(result.invalidCount).toBe(2);
    expect(result.errors.join(' ')).toMatch(/streamurl/i);
    expect(result.errors.join(' ')).toMatch(/coordinates/i);
  });

  it('filters invalid crime payload entries and enforces month/category contracts', () => {
    const payload: CrimePayloadCandidate[] = [
      {
        id: 'crime-1',
        category: 'violent-crime',
        location: { lat: 51.5185, lng: -0.1065 },
        street: { id: 1, name: 'Hatton Garden' },
        month: '2026-03',
      },
      {
        id: 'crime-2',
        category: 'not-a-real-category',
        location: { lat: 51.5181, lng: -0.1062 },
        street: { id: 2, name: 'Road' },
        month: '2026-03',
      },
      {
        id: 'crime-3',
        category: 'burglary',
        location: { lat: 51.5181, lng: -0.1062 },
        street: { id: 3, name: 'Road' },
        month: '26-03',
      },
    ];

    const result = sanitizeCrimePayload(payload);
    expect(result.valid).toHaveLength(1);
    expect(result.invalidCount).toBe(2);
    expect(result.errors.join(' ')).toMatch(/category/i);
    expect(result.errors.join(' ')).toMatch(/month/i);
  });
});
