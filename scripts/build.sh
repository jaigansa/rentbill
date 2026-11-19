#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v go >/dev/null 2>&1; then
    echo "Go is required to build RentBill." >&2
    exit 1
fi

echo "==> Building RentBill..."
mkdir -p build
CGO_ENABLED=0 go build -o build/rentbills .

echo "==> Build successful."
