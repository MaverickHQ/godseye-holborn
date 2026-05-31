/**
 * Godseye Proxy - AWS Lambda (HTTP API)
 *
 * Routes:
 * - GET /api/health
 * - GET /api/tfl/cameras
 * - GET /api/tfl/camera/:id
 */
import { buildCorsHeaders, getAllowedOrigin, getRequestOrigin } from './cors';
import { evaluateRateLimit, getClientIdentifier, resetRateLimitBuckets } from './rateLimit';
import { noContentResponse, jsonResponse, routeError, routeTooManyRequests } from './response';
import { getTflApiKey, handleTflCamera, handleTflCameraImage, handleTflCameras, isTflFallbackEnabled } from './tflHandlers';
import type { ApiGatewayProxyEventV2Like, ApiGatewayProxyResultV2Like } from './types';

function normalizePath(rawPath: string): string {
  const path = rawPath || '/';
  const apiPrefixIndex = path.indexOf('/api/');
  const fromApi = apiPrefixIndex >= 0 ? path.slice(apiPrefixIndex) : path;

  if (fromApi.length > 1 && fromApi.endsWith('/')) {
    return fromApi.slice(0, -1);
  }

  return fromApi;
}

function healthResponse(corsHeaders: Record<string, string>): ApiGatewayProxyResultV2Like {
  const diagnostics = {
    tflApiKeyConfigured: Boolean(getTflApiKey()),
    fallbackEnabled: isTflFallbackEnabled(),
  };

  return jsonResponse(
    200,
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      diagnostics,
    },
    corsHeaders,
  );
}

export async function handler(event: ApiGatewayProxyEventV2Like): Promise<ApiGatewayProxyResultV2Like> {
  const method = event.requestContext?.http?.method || 'GET';
  const path = normalizePath(event.rawPath);
  const requestOrigin = getRequestOrigin(event.headers);
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  if (method === 'OPTIONS') {
    return noContentResponse(corsHeaders);
  }

  if (method !== 'GET') {
    return routeError('Method not allowed', 405, corsHeaders);
  }

  if (path === '/api/health' || path.endsWith('/health')) {
    return healthResponse(corsHeaders);
  }

  const rateLimit = evaluateRateLimit(path, getClientIdentifier(event.headers));
  if (rateLimit.isLimited) {
    return routeTooManyRequests('Rate limit exceeded', rateLimit.retryAfterSeconds, corsHeaders);
  }

  if (path === '/api/tfl/cameras') {
    return handleTflCameras(corsHeaders);
  }

  if (path.startsWith('/api/tfl/camera/') && path.endsWith('/image')) {
    const cameraId = path.replace('/api/tfl/camera/', '').replace(/\/image$/, '');
    return handleTflCameraImage(cameraId, corsHeaders);
  }

  if (path.startsWith('/api/tfl/camera/')) {
    const cameraId = path.replace('/api/tfl/camera/', '');
    return handleTflCamera(cameraId, corsHeaders);
  }

  return routeError('Not found', 404, corsHeaders);
}

export function __resetRateLimiterForTests() {
  resetRateLimitBuckets();
}

export default { handler };
