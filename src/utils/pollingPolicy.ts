export type PollingSource = 'camera' | 'crime';
export type PollingOutcome = 'success' | 'failure' | 'rate_limited';

export interface PollingPolicy {
  source: PollingSource;
  baseIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  jitterRatio: number;
  failureBackoffMultiplier: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
  rateLimitBackoffMs: number;
}

export interface PollingState {
  consecutiveFailures: number;
  nextDelayMs: number;
  nextAttemptAtMs: number;
  circuitOpenUntilMs: number | null;
  lastOutcome: PollingOutcome | null;
}

function clampDelay(delayMs: number, policy: PollingPolicy): number {
  const min = Math.max(policy.minIntervalMs, 1_000);
  const max = Math.max(policy.maxIntervalMs, min);
  return Math.min(max, Math.max(min, delayMs));
}

function applyJitter(delayMs: number, ratio: number, random: () => number): number {
  if (ratio <= 0) return delayMs;
  const boundedRatio = Math.min(0.5, Math.max(0, ratio));
  const delta = delayMs * boundedRatio;
  const jittered = delayMs - delta + random() * (2 * delta);
  return Math.round(jittered);
}

export function createInitialPollingState(policy: PollingPolicy, nowMs: number = Date.now()): PollingState {
  const base = clampDelay(policy.baseIntervalMs, policy);
  return {
    consecutiveFailures: 0,
    nextDelayMs: base,
    nextAttemptAtMs: nowMs + base,
    circuitOpenUntilMs: null,
    lastOutcome: null,
  };
}

export function resolveNextPollDelay({
  policy,
  state,
  nowMs,
}: {
  policy: PollingPolicy;
  state: PollingState;
  nowMs: number;
}): number {
  if (state.circuitOpenUntilMs && nowMs < state.circuitOpenUntilMs) {
    return state.circuitOpenUntilMs - nowMs;
  }
  return clampDelay(state.nextDelayMs || policy.baseIntervalMs, policy);
}

export function applyPollingOutcome({
  policy,
  state,
  outcome,
  nowMs,
  retryAfterMs,
  random = Math.random,
}: {
  policy: PollingPolicy;
  state: PollingState;
  outcome: PollingOutcome;
  nowMs: number;
  retryAfterMs?: number;
  random?: () => number;
}): PollingState {
  if (outcome === 'success') {
    const delay = applyJitter(clampDelay(policy.baseIntervalMs, policy), policy.jitterRatio, random);
    return {
      consecutiveFailures: 0,
      nextDelayMs: delay,
      nextAttemptAtMs: nowMs + delay,
      circuitOpenUntilMs: null,
      lastOutcome: 'success',
    };
  }

  const failures = state.consecutiveFailures + 1;
  const rateLimitedDelay = Math.max(policy.rateLimitBackoffMs, retryAfterMs || 0);
  const failureDelay =
    policy.baseIntervalMs * Math.pow(policy.failureBackoffMultiplier, Math.max(0, failures - 1));
  const rawDelay = outcome === 'rate_limited' ? rateLimitedDelay : failureDelay;
  const boundedDelay = clampDelay(rawDelay, policy);

  if (failures >= policy.circuitBreakerFailureThreshold) {
    return {
      consecutiveFailures: failures,
      nextDelayMs: clampDelay(policy.circuitBreakerCooldownMs, policy),
      nextAttemptAtMs: nowMs + clampDelay(policy.circuitBreakerCooldownMs, policy),
      circuitOpenUntilMs: nowMs + clampDelay(policy.circuitBreakerCooldownMs, policy),
      lastOutcome: outcome,
    };
  }

  const jitteredDelay = applyJitter(boundedDelay, policy.jitterRatio, random);

  return {
    consecutiveFailures: failures,
    nextDelayMs: jitteredDelay,
    nextAttemptAtMs: nowMs + jitteredDelay,
    circuitOpenUntilMs: null,
    lastOutcome: outcome,
  };
}
