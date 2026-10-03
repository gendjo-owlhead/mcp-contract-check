#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CLI="$REPO_ROOT/mcp-contract-check/dist/cli.js"

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <RUN_ID> <FEATURE_NAME> [CLI_ARGS...]" >&2
  exit 1
fi

RUN_ID="$1"
FEATURE_NAME="$2"
shift 2

ARTIFACTS_DIR="$REPO_ROOT/artifacts/verify-mcp-contract-check/$RUN_ID"
mkdir -p "$ARTIFACTS_DIR"
LOG_FILE="$ARTIFACTS_DIR/${FEATURE_NAME}.log"

if [ "$FEATURE_NAME" = "doctor" ]; then
  echo "Running doctor check..."
  if [ ! -f "$CLI" ]; then
    echo "ERROR: CLI binary not found at $CLI. Run 'npm run build' first." >&2
    exit 1
  fi
  NODE_VER="$(node -v)"
  CLI_VER="$(node "$CLI" --version)"
  echo "Node version: $NODE_VER" | tee "$LOG_FILE"
  echo "CLI version: $CLI_VER" | tee -a "$LOG_FILE"
  echo "Doctor check PASSED" | tee -a "$LOG_FILE"
  exit 0
fi

# Run CLI and capture full execution log
echo "=== Command ===" > "$LOG_FILE"
echo "node $CLI $@" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

set +e
STDOUT_FILE=$(mktemp)
STDERR_FILE=$(mktemp)

node "$CLI" "$@" > "$STDOUT_FILE" 2> "$STDERR_FILE"
EXIT_CODE=$?

echo "=== Exit Code ===" >> "$LOG_FILE"
echo "$EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

echo "=== STDOUT ===" >> "$LOG_FILE"
cat "$STDOUT_FILE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

echo "=== STDERR ===" >> "$LOG_FILE"
cat "$STDERR_FILE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

cat "$STDOUT_FILE"
cat "$STDERR_FILE" >&2

rm -f "$STDOUT_FILE" "$STDERR_FILE"
exit $EXIT_CODE
