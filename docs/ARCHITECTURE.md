# Architecture

## Overview

Godseye Holborn is a static React SPA deployed to AWS CloudFront + S3. Live camera data from TfL is fetched via an AWS Lambda proxy (Node 22 arm64) exposed through API Gateway. Crime data comes directly from the public Police UK API. The current product scope is Holborn-only (single-location v1).

## System Diagram

```
Browser
  │
  ├─ /* ──────────────────▶ CloudFront ──▶ S3 (OAC)
  │                              │         Static assets
  │                              │
  └─ /api/* ───────────────▶ CloudFront ──▶ API Gateway ──▶ Lambda
                                                              godseye-holborn-proxy
                                                              (eu-west-2, Node 22 arm64)
                                                                │
                                                     ┌──────────┴──────────┐
                                                     │   api.tfl.gov.uk     │
                                                     │   (TFL_API_KEY env)  │
                                                     └─────────────────────┘

Browser ──▶ data.police.uk (direct, no auth required)
```

## Components

### CloudFront Distribution

Two cache behaviours:

| Path | Origin | Cache |
|------|--------|-------|
| `/api/*` | API Gateway | No cache (pass-through) |
| `/*` (default) | S3 bucket | Hashed assets: 1 year; `index.html`: no-cache |

### S3 Bucket (eu-west-2)

- Static website hosting disabled — access via CloudFront OAC only
- Bucket policy grants `s3:GetObject` to the CloudFront distribution ARN
- Source maps excluded from sync

### Lambda (eu-west-2)

- Runtime: Node.js 22, arm64
- Handler: `index.handler`
- Env vars: `TFL_API_KEY`, `ALLOWED_ORIGIN`
- Routes: `GET /api/health`, `GET /api/tfl/cameras`, `GET /api/tfl/camera/:id`
- CORS: handled in-function (API Gateway CORS disabled)

### API Gateway (HTTP API)

- `$default` stage with auto-deploy
- Proxy integration → Lambda
- No throttling (Lambda handles rate limiting)

## Data Flows

### Camera data

```
Frontend → GET /api/tfl/cameras
         → API Gateway → Lambda
         → api.tfl.gov.uk/Place/Type/JamCam (app_key query param injected server-side)
         → filtered + normalised → CameraSource[]
```

### Crime data

```
Frontend → data.police.uk/api/crimes-street/all-crime
         (direct fetch, no auth, public API)
         → Crime[]
```

## Security Model

- TfL API key lives only in Lambda environment variables — never in the frontend bundle
- Frontend camera runtime is proxy-only and must not call TfL upstream directly
- S3 bucket is private; only CloudFront OAC can read objects
- CORS: Lambda returns `Access-Control-Allow-Origin: <ALLOWED_ORIGIN>` (exact match, not wildcard)
- Police UK: public API, no credentials

## Cache Strategy

| Asset type | Cache-Control | Rationale |
|------------|---------------|-----------|
| Hashed JS/CSS (`/assets/*`) | `public, max-age=31536000, immutable` | Content-hash in filename guarantees freshness |
| `index.html` | `no-cache, no-store, must-revalidate` | Must always return latest shell with new asset hashes |
| Source maps | Excluded from S3 sync | Not needed in production |

## Cost (approximate, low traffic)

| Service | Est. monthly |
|---------|-------------|
| CloudFront | < $1 |
| S3 | < $0.10 |
| Lambda invocations | < $0.01 |
| API Gateway | < $0.01 |

## Design Notes

**Why Lambda + API Gateway for the proxy.** The TfL JamCam API requires an `app_key` that must not be exposed in frontend JavaScript, so a server-side proxy is required. Running it as a second CloudFront origin keeps the whole stack within AWS:

- Single cloud provider — simpler IAM, billing, and observability.
- CloudFront dual-origin means `/api/*` routes straight to API Gateway without a cross-provider hop.
- Lambda arm64 (Graviton) keeps cost and cold-start low at this scale.
- Secrets live in Lambda environment variables alongside other AWS configuration.

**Trade-off.** Lambda cold starts (~200–400ms) are acceptable for a dashboard that polls on a 60s cadence; payloads are kept lean and cached where safe.
