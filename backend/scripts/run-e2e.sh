#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p bin
go build -tags integration -o bin/gymbro-e2e ./internal/e2e
exec bin/gymbro-e2e
