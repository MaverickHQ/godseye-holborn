import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { getCrimesInHolborn } from '@/services/policeApi';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

type MockAxiosResponse = {
  data: Array<{
    id: number;
    category: string;
    location_type: string;
    location_subtype: string;
    month: string;
    location: {
      latitude: string;
      longitude: string;
      street: {
        id: number;
        name: string;
      };
    };
    persistent_id?: string;
  }>;
};

function streetCrime(month: string, seed: number): MockAxiosResponse['data'][number] {
  return {
    id: seed,
    category: 'violent-crime',
    location_type: 'Force',
    location_subtype: '',
    month,
    location: {
      latitude: '51.5185',
      longitude: '-0.1065',
      street: {
        id: 1000 + seed,
        name: `Holborn Street ${seed}`,
      },
    },
    persistent_id: `persist-${month}-${seed}`,
  };
}

describe('policeApi rolling publication continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('backs off to older published months when recent months are empty', async () => {
    const mockedGet = vi.mocked(axios.get);
    mockedGet
      .mockResolvedValueOnce({ data: [] } as MockAxiosResponse) // 2026-05
      .mockResolvedValueOnce({ data: [] } as MockAxiosResponse) // 2026-04
      .mockResolvedValueOnce({ data: [] } as MockAxiosResponse) // 2026-03
      .mockResolvedValueOnce({ data: [streetCrime('2026-02', 1)] } as MockAxiosResponse)
      .mockResolvedValueOnce({ data: [streetCrime('2026-01', 2)] } as MockAxiosResponse)
      .mockResolvedValueOnce({ data: [streetCrime('2025-12', 3)] } as MockAxiosResponse);

    const crimes = await getCrimesInHolborn(3);

    expect(mockedGet).toHaveBeenCalledTimes(6);
    expect(crimes.length).toBeGreaterThan(0);
    expect(crimes.some(crime => crime.month === '2026-02')).toBe(true);
    expect(crimes.some(crime => crime.month === '2025-12')).toBe(true);
  });
});
