#!/usr/bin/env bash
# linux.sh - Wrapper for rentbill.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/rentbill.sh" "$@"
