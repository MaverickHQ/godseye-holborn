import type { ApiGatewayProxyResultV2Like } from './types';

export function jsonResponse(
  statusCode: number,
  payload: unknown,
  corsHeaders: Record<string, string>,
): ApiGatewayProxyResultV2Like {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Last-Modified': new Date().toUTCString(),
      ...corsHeaders,
    },
    body: JSON.stringify(payload),
  };
}

export function noContentResponse(corsHeaders: Record<string, string>): ApiGatewayProxyResultV2Like {
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: '',
  };
}

export function routeError(
  message: string,
  statusCode: number,
  corsHeaders: Record<string, string>,
): ApiGatewayProxyResultV2Like {
  return jsonResponse(statusCode, { error: message, status: statusCode }, corsHeaders);
}

export function routeTooManyRequests(
  message: string,
  retryAfterSeconds: number,
  corsHeaders: Record<string, string>,
): ApiGatewayProxyResultV2Like {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
      ...corsHeaders,
    },
    body: JSON.stringify({
      error: message,
      status: 429,
      retryAfterSeconds,
    }),
  };
}

export function binaryResponse(
  statusCode: number,
  bytes: Uint8Array,
  contentType: string,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): ApiGatewayProxyResultV2Like {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      ...extraHeaders,
      ...corsHeaders,
    },
    body: Buffer.from(bytes).toString('base64'),
    isBase64Encoded: true,
  };
}
