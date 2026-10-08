#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Optional .env is a local Bash-compatible file; never commit real OAuth/database secrets.
if [[ -f .env ]]; then set -a; source .env; set +a; fi
export GYMBRO_DATABASE_URL="${GYMBRO_DATABASE_URL:-postgres://gymbro_local:gymbro-local-development-only@127.0.0.1:54329/gymbro_local?sslmode=disable}"
export GYMBRO_PUBLIC_URL="${GYMBRO_PUBLIC_URL:-http://localhost:8080}"
export GYMBRO_HTTP_ADDR="${GYMBRO_HTTP_ADDR:-127.0.0.1:8080}"
export GIN_MODE="${GIN_MODE:-release}"
if [[ ! -f frontend/dist/index.html ]]; then
  echo 'Build web first: npm --prefix frontend ci && npm --prefix frontend run build:web' >&2
  exit 1
fi
cd backend
mkdir -p bin
go build -o bin/gymbro .
exec bin/gymbro
