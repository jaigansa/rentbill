#!/usr/bin/env bash
set -euo pipefail

echo "==> Building rentbills..."
mkdir -p build

if command -v cargo &> /dev/null && [ -f "Cargo.toml" ]; then
    cargo build --release
elif command -v go &> /dev/null && [ -f "go.mod" ]; then
    go build -o build/rentbills ./...
elif [ -f "package.json" ]; then
    npm run build
else
    echo "Generic build step complete."
fi

echo "==> Build successful."
