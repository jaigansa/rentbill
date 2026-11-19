#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v go >/dev/null 2>&1; then
    echo "Go is required to test RentBill." >&2
    exit 1
fi

echo "==> Running RentBill test suite..."
CGO_ENABLED=0 go test ./...

echo "==> All test assertions verified."
