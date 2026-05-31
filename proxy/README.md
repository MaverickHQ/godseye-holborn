# Godseye Proxy — AWS Lambda

Secure API proxy for Godseye Holborn. Runs as an AWS Lambda function behind API Gateway HTTP API.

## Purpose

- Keep upstream API keys server-side (`TFL_API_KEY`)
- Normalize responses for frontend use
- Enforce explicit CORS policy (`ALLOWED_ORIGIN`)

## Runtime

- Node.js 20+ compatible handler
- Lambda deployment target: `nodejs22.x` recommended

## Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/tfl/cameras` | TfL camera list passthrough |
| `GET /api/tfl/camera/:id` | TfL single camera passthrough |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_ORIGIN` | Yes | Primary allowed web origin for CORS fallback |
| `TFL_API_KEY` | Yes | TfL Open Data `app_key` |

## Build Artifact

```bash
cd proxy
npm install
npm run build:zip
```

Outputs:

- `proxy/dist/index.js`
- `proxy/function.zip`

## Example Deploy (manual)

```bash
aws lambda update-function-code \
  --function-name <your-proxy-function-name> \
  --zip-file fileb://proxy/function.zip \
  --region eu-west-2
```

## Notes

- Police UK API (`data.police.uk`) is public and called directly from frontend.
- For unknown request origins, CORS falls back to `ALLOWED_ORIGIN`.
