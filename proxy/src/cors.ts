const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:5173';

function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function getConfiguredAllowedOrigins(): string[] {
  return parseAllowedOrigins(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
}

export function getAllowedOrigin(requestOrigin: string): string {
  const configuredOrigins = getConfiguredAllowedOrigins();
  const configuredOrigin = configuredOrigins[0] || DEFAULT_ALLOWED_ORIGIN;
  const localOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ]);
  const configuredLocals = configuredOrigins.filter(origin =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin),
  );
  const hasWildcardLocal =
    configuredOrigins.includes('http://localhost:*') || configuredOrigins.includes('http://127.0.0.1:*');

  if (!requestOrigin) {
    return configuredOrigin;
  }

  if (configuredOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if ((hasWildcardLocal || configuredLocals.length > 0) && localOrigins.has(requestOrigin)) {
    return requestOrigin;
  }

  return configuredOrigin;
}

export function getRequestOrigin(headers: Record<string, string | undefined> | undefined): string {
  if (!headers) {
    return '';
  }

  return headers.origin || headers.Origin || '';
}

export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'Date,Last-Modified,Retry-After',
    'Access-Control-Max-Age': '86400',
  };
}
