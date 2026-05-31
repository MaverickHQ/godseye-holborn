#!/usr/bin/env bash
set -euo pipefail

LANE="${1:-prod}"
PROFILE="${AWS_PROFILE:-default}"

require_var() {
  local var_name="$1"
  local var_value="$2"
  if [[ -z "$var_value" ]]; then
    echo "Missing required env var: $var_name"
    exit 1
  fi
}

if [[ "$LANE" == "test" ]]; then
  S3_BUCKET="${S3_BUCKET_TEST:-}"
  CF_DIST_ID="${CF_DIST_ID_TEST:-}"
  PROXY_URL="${VITE_PROXY_BASE_URL_TEST:-}"
  require_var "S3_BUCKET_TEST" "$S3_BUCKET"
  require_var "CF_DIST_ID_TEST" "$CF_DIST_ID"
  require_var "VITE_PROXY_BASE_URL_TEST" "$PROXY_URL"
else
  S3_BUCKET="${S3_BUCKET:-}"
  CF_DIST_ID="${CF_DIST_ID:-}"
  PROXY_URL="${VITE_PROXY_BASE_URL:-}"
  require_var "S3_BUCKET" "$S3_BUCKET"
  require_var "CF_DIST_ID" "$CF_DIST_ID"
  require_var "VITE_PROXY_BASE_URL" "$PROXY_URL"
fi

DEPLOY_VERSION_TAG="${DEPLOY_VERSION_TAG:-$(npm pkg get version | tr -d '"')}"
DEPLOY_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DEPLOY_TIMESTAMP_COMPACT="$(date -u +"%Y%m%dT%H%M%SZ")"
COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
VERSIONED_METADATA_KEY="${DEPLOY_VERSION_TAG}-${COMMIT_SHA}-${DEPLOY_TIMESTAMP_COMPACT}.json"

echo "▶ Running pre-deploy gates (lint, type-check, unit tests)..."
npm run lint
npm run type-check
npm run test:unit

echo "▶ Building..."
VITE_PROXY_BASE_URL="$PROXY_URL" npm run build

cat > dist/deploy-metadata.json <<JSON
{
  "lane": "${LANE}",
  "versionTag": "${DEPLOY_VERSION_TAG}",
  "deployedAt": "${DEPLOY_TIMESTAMP}",
  "commitSha": "${COMMIT_SHA}",
  "proxyBaseUrl": "${PROXY_URL}"
}
JSON

echo "▶ Syncing hashed assets (1 year cache)..."
aws s3 sync dist/assets/ "s3://${S3_BUCKET}/assets/" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.map" --profile "$PROFILE"

echo "▶ Uploading index.html (no-cache)..."
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html" --profile "$PROFILE"

echo "▶ Syncing remaining files and removing stale..."
aws s3 sync dist/ "s3://${S3_BUCKET}/" --delete \
  --exclude "assets/*" --exclude "index.html" --exclude "*.map" --exclude "data/*" \
  --profile "$PROFILE"

echo "▶ Publishing deploy metadata..."
aws s3 cp dist/deploy-metadata.json "s3://${S3_BUCKET}/deploy-metadata/${LANE}/latest.json" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "application/json" --profile "$PROFILE"
aws s3 cp dist/deploy-metadata.json "s3://${S3_BUCKET}/deploy-metadata/${LANE}/${VERSIONED_METADATA_KEY}" \
  --cache-control "public, max-age=31536000, immutable" \
  --content-type "application/json" --profile "$PROFILE"

echo "▶ Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" --paths "/*" \
  --profile "$PROFILE" --query 'Invalidation.{Id:Id,Status:Status}' --output table

echo "✓ Deployed lane=${LANE} version=${DEPLOY_VERSION_TAG} commit=${COMMIT_SHA}"
