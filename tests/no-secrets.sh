#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN='AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----|(api[_-]?key|secret|access[_-]?key|private[_-]?key|token)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_\-\/+=]{20,}["'"'"']'

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

# Scan tracked text files only.
if ! git ls-files -z > "$TMP_FILE"; then
  echo "[no-secrets] failed to enumerate tracked files" >&2
  exit 2
fi

if command -v rg >/dev/null 2>&1; then
  if xargs -0 rg --no-messages -i -n --no-heading -g '!package-lock.json' -g '!**/*.svg' -g '!**/*.png' -g '!**/*.jpg' -g '!**/*.jpeg' -g '!**/*.map' "$PATTERN" < "$TMP_FILE"; then
    echo "[no-secrets] potential secret pattern detected" >&2
    exit 1
  fi
elif command -v grep >/dev/null 2>&1; then
  if xargs -0 grep -E -i -n -H -- "$PATTERN" < "$TMP_FILE"; then
    echo "[no-secrets] potential secret pattern detected" >&2
    exit 1
  fi
else
  echo "[no-secrets] requires either ripgrep (rg) or grep" >&2
  exit 2
fi

echo "[no-secrets] clear"
