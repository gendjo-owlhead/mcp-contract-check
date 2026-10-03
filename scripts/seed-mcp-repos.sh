#!/usr/bin/env bash
# ==============================================================================
# MCP Contract Check — Repository Seeding & PR Scaffold Generator
# Usage: ./scripts/seed-mcp-repos.sh <target-repo-dir> <server-type> [command]
# Types: node | python | docker
# ==============================================================================

set -euo pipefail

TARGET_DIR="${1:-.}"
SERVER_TYPE="${2:-node}"
COMMAND="${3:-}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Directory '$TARGET_DIR' does not exist."
  exit 1
fi

WORKFLOW_DIR="$TARGET_DIR/.github/workflows"
mkdir -p "$WORKFLOW_DIR"

WORKFLOW_FILE="$WORKFLOW_DIR/mcp-contract-check.yml"

case "$SERVER_TYPE" in
  node)
    DEFAULT_CMD="${COMMAND:-node dist/index.js}"
    cat <<EOF > "$WORKFLOW_FILE"
name: MCP Contract Check

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  contract-validation:
    name: Validate MCP Tool Contracts
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies & build
        run: |
          npm ci
          npm run build --if-present

      - name: Run MCP Contract & Schema Fuzz Check
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "$DEFAULT_CMD"
          fuzz: "true"
          baseline: "contracts/mcp-baseline.json"
          save-contract: "contracts/mcp-current.json"
EOF
    ;;

  python)
    DEFAULT_CMD="${COMMAND:-python -m my_mcp_server}"
    cat <<EOF > "$WORKFLOW_FILE"
name: MCP Contract Check

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  contract-validation:
    name: Validate MCP Tool Contracts
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -e .

      - name: Run MCP Contract & Schema Fuzz Check
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "$DEFAULT_CMD"
          fuzz: "true"
          baseline: "contracts/mcp-baseline.json"
          save-contract: "contracts/mcp-current.json"
EOF
    ;;

  docker)
    DEFAULT_CMD="${COMMAND:-docker run --rm -i my-mcp-server:latest}"
    cat <<EOF > "$WORKFLOW_FILE"
name: MCP Contract Check

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  contract-validation:
    name: Validate MCP Tool Contracts
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Build Docker container
        run: docker build -t my-mcp-server:latest .

      - name: Run MCP Contract & Schema Fuzz Check
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "$DEFAULT_CMD"
          fuzz: "true"
          baseline: "contracts/mcp-baseline.json"
          save-contract: "contracts/mcp-current.json"
EOF
    ;;

  *)
    echo "Unknown server type: $SERVER_TYPE. Use 'node', 'python', or 'docker'."
    exit 1
    ;;
esac

echo "Created workflow: $WORKFLOW_FILE"
echo ""
echo "=== README Badge to Insert ==="
echo '[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)'
echo ""
echo "=== Suggested PR Title ==="
echo "ci: add automated MCP contract testing and schema fuzzing"
echo ""
echo "=== Suggested PR Body ==="
cat <<'PR_BODY'
### Summary
This PR integrates automated Model Context Protocol (MCP) contract testing and schema fuzzing into CI using `gendjo-owlhead/mcp-contract-check@v1`.

### Why this matters
1. **Zero-fixture schema fuzzing:** Automatically validates tool schemas by synthesizing boundary and negative cases against real server responses.
2. **Breaking change protection:** Flags unintended schema modifications or removed tools in pull requests before they impact LLM agents.
3. **Continuous reliability:** Ensures client applications (Claude, Cursor, Antigravity) never encounter runtime protocol failures.

### What was added
- Added `.github/workflows/mcp-contract-check.yml`
- Added the "MCP Contract Validated" badge to `README.md`
PR_BODY
