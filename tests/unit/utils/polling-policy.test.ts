import { describe, expect, it } from 'vitest';
import {
  applyPollingOutcome,
  createInitialPollingState,
  resolveNextPollDelay,
  type PollingPolicy,
} from '@/utils/pollingPolicy';

const POLICY: PollingPolicy = {
  source: 'camera',
  baseIntervalMs: 60_000,
  minIntervalMs: 60_000,
  maxIntervalMs: 300_000,
  jitterRatio: 0,
  failureBackoffMultiplier: 2,
  circuitBreakerFailureThreshold: 3,
  circuitBreakerCooldownMs: 180_000,
  rateLimitBackoffMs: 240_000,
};

describe('polling policy contract', () => {
  it('enforces minimum interval when base interval is lower than min', () => {
    const state = createInitialPollingState({
      ...POLICY,
      baseIntervalMs: 15_000,
      minIntervalMs: 60_000,
    });

    expect(state.nextDelayMs).toBe(60_000);
  });

  it('escalates backoff on consecutive failures and resets on success', () => {
    const first = applyPollingOutcome({
      policy: POLICY,
      state: createInitialPollingState(POLICY),
      outcome: 'failure',
      nowMs: 0,
    });
    expect(first.consecutiveFailures).toBe(1);
    expect(first.nextDelayMs).toBe(60_000);

    const second = applyPollingOutcome({
      policy: POLICY,
      state: first,
      outcome: 'failure',
      nowMs: 1_000,
    });
    expect(second.consecutiveFailures).toBe(2);
    expect(second.nextDelayMs).toBe(120_000);

    const recovered = applyPollingOutcome({
      policy: POLICY,
      state: second,
      outcome: 'success',
      nowMs: 2_000,
    });
    expect(recovered.consecutiveFailures).toBe(0);
    expect(recovered.nextDelayMs).toBe(60_000);
  });

  it('opens circuit breaker at threshold and enforces cooldown before retry', () => {
    const first = applyPollingOutcome({
      policy: POLICY,
      state: createInitialPollingState(POLICY),
      outcome: 'failure',
      nowMs: 0,
    });
    const second = applyPollingOutcome({
      policy: POLICY,
      state: first,
      outcome: 'failure',
      nowMs: 1_000,
    });
    const third = applyPollingOutcome({
      policy: POLICY,
      state: second,
      outcome: 'failure',
      nowMs: 2_000,
    });

    expect(third.circuitOpenUntilMs).toBe(182_000);
    expect(resolveNextPollDelay({ policy: POLICY, state: third, nowMs: 3_000 })).toBe(179_000);
    expect(resolveNextPollDelay({ policy: POLICY, state: third, nowMs: 183_000 })).toBe(180_000);
  });

  it('uses rate-limit retry-after window and caps it to max interval', () => {
    const state = applyPollingOutcome({
      policy: POLICY,
      state: createInitialPollingState(POLICY),
      outcome: 'rate_limited',
      retryAfterMs: 500_000,
      nowMs: 10_000,
    });

    expect(state.nextDelayMs).toBe(300_000);
    expect(state.consecutiveFailures).toBe(1);
  });

  it('applies deterministic jitter when enabled', () => {
    const jitterPolicy: PollingPolicy = {
      ...POLICY,
      jitterRatio: 0.2,
    };
    const state = applyPollingOutcome({
      policy: jitterPolicy,
      state: createInitialPollingState(jitterPolicy),
      outcome: 'success',
      nowMs: 0,
      random: () => 1,
    });

    expect(state.nextDelayMs).toBe(72_000);
  });
});
