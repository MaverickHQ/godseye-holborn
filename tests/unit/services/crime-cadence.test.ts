import { describe, expect, it } from 'vitest';
import { resolveCrimePublicationCadence } from '@/services/crimeCadence';

describe('crime publication cadence resolver', () => {
  it('resolves latest published month and next expected release window across month boundaries', async () => {
    const cadence = await resolveCrimePublicationCadence({
      fetchLastUpdated: async () => ({ date: '2026-03-01' }),
      fetchAvailableMonths: async () => [
        { date: '2026-03' },
        { date: '2026-02' },
        { date: '2026-01' },
      ],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    expect(cadence.dataCurrentThroughMonth).toBe('2026-03');
    expect(cadence.nextExpectedReleaseWindow).toContain('April 2026');
    expect(cadence.nextExpectedReleaseWindow).toContain('May 2026');
    expect(cadence.lagMonths).toBe(2);
  });

  it('marks next month as available now when release has landed', async () => {
    const cadence = await resolveCrimePublicationCadence({
      fetchLastUpdated: async () => ({ date: '2026-03-01' }),
      fetchAvailableMonths: async () => [
        { date: '2026-06' },
        { date: '2026-05' },
        { date: '2026-04' },
        { date: '2026-03' },
      ],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    expect(cadence.dataCurrentThroughMonth).toBe('2026-06');
    expect(cadence.nextExpectedReleaseWindow).toBe('June 2026 available now');
    expect(cadence.lagMonths).toBe(0);
  });

  it('returns fallback cadence when source checks fail', async () => {
    const cadence = await resolveCrimePublicationCadence({
      fetchLastUpdated: async () => {
        throw new Error('nope');
      },
      fetchAvailableMonths: async () => [],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    expect(cadence.dataCurrentThroughMonth).toBeNull();
    expect(cadence.nextExpectedReleaseWindow).toContain('Unavailable');
    expect(cadence.lagMonths).toBeNull();
  });
});
