const DEFAULT_RATE_LIMIT_MAX = 120;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimitBuckets = new Map<string, { count: number; windowStartMs: number }>();

function getRateLimitMax(): number {
  const raw = Number(process.env.RATE_LIMIT_MAX || DEFAULT_RATE_LIMIT_MAX);
  if (!Number.isFinite(raw)) {
    return DEFAULT_RATE_LIMIT_MAX;
  }

  return Math.max(0, Math.floor(raw));
}

function getRateLimitWindowMs(): number {
  const raw = Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULT_RATE_LIMIT_WINDOW_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_RATE_LIMIT_WINDOW_MS;
  }

  return Math.min(Math.floor(raw), 3_600_000);
}

export function getClientIdentifier(headers: Record<string, string | undefined> | undefined): string {
  if (!headers) {
    return 'anonymous';
  }

  const forwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = headers['x-real-ip'] || headers['X-Real-IP'];
  if (realIp) {
    return realIp;
  }

  return 'anonymous';
}

function routeRateLimitBucket(path: string): string | null {
  if (path === '/api/tfl/cameras') {
    return '/api/tfl/cameras';
  }

  if (path.startsWith('/api/tfl/camera/')) {
    return '/api/tfl/camera/:id';
  }

  return null;
}

export function evaluateRateLimit(path: string, clientId: string): { isLimited: boolean; retryAfterSeconds: number } {
  const bucket = routeRateLimitBucket(path);
  if (!bucket) {
    return { isLimited: false, retryAfterSeconds: 0 };
  }

  const maxRequests = getRateLimitMax();
  if (maxRequests <= 0) {
    return { isLimited: false, retryAfterSeconds: 0 };
  }

  const windowMs = getRateLimitWindowMs();
  const now = Date.now();
  const key = `${bucket}:${clientId}`;
  const current = rateLimitBuckets.get(key);

  if (!current || now - current.windowStartMs >= windowMs) {
    rateLimitBuckets.set(key, { count: 1, windowStartMs: now });
    return { isLimited: false, retryAfterSeconds: 0 };
  }

  if (current.count >= maxRequests) {
    const elapsed = now - current.windowStartMs;
    const remainingMs = Math.max(0, windowMs - elapsed);
    return { isLimited: true, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }

  current.count += 1;
  rateLimitBuckets.set(key, current);
  return { isLimited: false, retryAfterSeconds: 0 };
}

export function resetRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}
