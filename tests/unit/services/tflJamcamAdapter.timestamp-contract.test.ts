import { describe, expect, it } from 'vitest';
import { normalizeJamCamPayload } from '@/services/tflJamcamAdapter';

describe('tflJamcamAdapter timestamp truthfulness contract', () => {
  it('does not synthesize lastVerified from local observation time when source timestamp is missing', () => {
    const payload = [
      {
        id: 'JamCams_00002.00865',
        commonName: 'Farringdon Rd/Cowcross St',
        lat: 51.52,
        lon: -0.1059,
        additionalProperties: [
          { key: 'imageUrl', value: 'https://example.com/cam.jpg' },
        ],
      },
    ];

    const records = normalizeJamCamPayload(payload);

    expect(records).toHaveLength(1);
    expect(records[0]?.lastVerified).toBe('');
  });

  it('uses TfL additionalProperties.modified as source timestamp when lastUpdated is absent', () => {
    const payload = [
      {
        id: 'JamCams_00002.00865',
        commonName: 'Farringdon Rd/Cowcross St',
        lat: 51.52,
        lon: -0.1059,
        additionalProperties: [
          {
            key: 'imageUrl',
            value: 'https://example.com/cam.jpg',
            modified: '2026-05-29T13:14:15.000Z',
          },
        ],
      },
    ];

    const records = normalizeJamCamPayload(payload);

    expect(records).toHaveLength(1);
    expect(records[0]?.lastVerified).toBe('2026-05-29T13:14:15.000Z');
  });
});
