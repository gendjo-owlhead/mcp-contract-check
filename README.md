# MCP Contract Check

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Automated tool contract testing, schema fuzzing, and breaking change detection for Model Context Protocol (MCP) servers in CI/CD.

`mcp-contract-check` connects to your MCP server over stdio or remote SSE HTTP, discovers registered tools, executes test cases or synthesizes fuzzed inputs, and fails the build immediately if any tool response deviates from its declared JSON Schema.

---

## Features

- **Standard I/O and Remote SSE**: Test local processes via `--command` or remote endpoints via `--url` and `--header`.
- **Automatic Schema Fuzzer**: Synthesize valid arguments automatically from tool input schemas with `--fuzz`. No manual test fixtures required to get started.
- **Breaking Change Detection**: Compare discovered tools and schemas against a baseline contract with `--baseline`. Catch removed tools, added required parameters, narrowed enums, and removed output properties before release.
- **Contract Snapshotting**: Save discovered tool interfaces into versioned JSON contracts with `--save-contract`.
- **Fixture-Driven Verification**: Test edge cases and expected error responses using JSON fixture files.

---

## Quickstart

Add `mcp-contract-check` to your GitHub Actions workflow.

### 1. Stdio Server Check

```yaml
name: MCP Contract Check

on:
  push:
    branches: [main]
  pull_request:

jobs:
  contract-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run MCP Contract Check
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          cases: "cases"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 2. Automatic Schema Fuzzing (Zero Fixtures)

```yaml
      - name: Run Schema Fuzz Check
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          fuzz: "true"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 3. Remote SSE Server Check

```yaml
      - name: Check Remote MCP Server
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          url: "https://mcp.internal.example.com/sse"
          headers: |
            Authorization: Bearer ${{ secrets.MCP_API_TOKEN }}
            X-Environment: staging
          fuzz: "true"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 4. Breaking Change Detection in Pull Requests

```yaml
      - name: Check Backward Compatibility
        uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          baseline: "contracts/mcp-baseline.json"
          save-contract: "contracts/mcp-current.json"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

---

## Action Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `command` | The stdio server command to start your MCP server (e.g. `node server.js` or `python -m my_server`). | No* | — |
| `url` | Remote MCP server SSE endpoint URL (e.g. `https://api.example.com/sse`). | No* | — |
| `headers` | Custom HTTP headers for remote SSE transport (formatted as JSON or `key: value` lines). | No | — |
| `cases` | Directory containing JSON test case fixtures for tool arguments. | No | `cases` |
| `fuzz` | Automatically synthesize valid test arguments from tool input schemas. | No | `false` |
| `baseline` | Path to a baseline contract JSON snapshot to check for breaking changes. | No | — |
| `save-contract` | Path to save the discovered server tool contracts as a JSON snapshot file. | No | — |
| `license-key` | License key required for private repositories. Not needed for public open-source repos. | No | — |
| `license-server-url` | Custom license verification server URL. | No | `https://mcp-license-service.onrender.com` |

\* Either `command` or `url` must be provided.

---

## Action Outputs

| Output | Description |
|---|---|
| `total` | Total number of contract test cases checked. |
| `passed` | Number of passed contract test cases. |
| `failed` | Number of failed contract test cases. |
| `compatible` | Whether contract changes are backward-compatible with the baseline (`true`/`false`). |

---

## Embeddable Badge

Add the official validation badge to your MCP server repository:

[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)

```markdown
[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)
```

---

## Fixtures Format

Create a directory (e.g. `cases/`) containing JSON files with fixtures for your tools (e.g. `cases/calculator.json`):

```json
[
  {
    "tool": "calculate_sum",
    "arguments": {
      "a": 5,
      "b": 10
    },
    "expected": "success"
  },
  {
    "tool": "calculate_sum",
    "arguments": {
      "a": "invalid-string"
    },
    "expected": "fail"
  }
]
```

- `tool`: Registered name of the tool to invoke.
- `arguments`: Argument payload passed to the tool.
- `expected`: Expected outcome (`"success"` or `"fail"`).

---

## CLI Usage

You can also run the contract checker locally via the `mcp-check` CLI:

```bash
# Run against local stdio server
npx @local/mcp-contract-check --command "node server.js" --cases cases

# Run automatic schema fuzzing without writing fixtures
npx @local/mcp-contract-check --command "node server.js" --fuzz

# Save contract snapshot
npx @local/mcp-contract-check --command "node server.js" --save-contract contracts/v1.json

# Check against baseline for breaking changes
npx @local/mcp-contract-check --command "node server.js" --baseline contracts/v1.json

# Test remote SSE server with custom headers
npx @local/mcp-contract-check --url "https://api.example.com/sse" -H "Authorization: Bearer token" --fuzz
```

---

## Licensing & Pricing

- **Public Repositories**: **100% Free**. No license key or registration required.
- **Private Repositories**: Requires an active license.
  - **Pricing**: €29/month + VAT
  - **Subscribe**: [Buy License via Stripe](https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00)
  - Add your Stripe billing email, Subscription ID (`sub_...`), or Customer ID (`cus_...`) to your repository secrets as `MCP_LICENSE_KEY`.

---

## Monorepo Packages

This repository contains the complete MCP contract testing suite:

- **[mcp-contract-check](./mcp-contract-check/)**: Core TypeScript CLI (`mcp-check`) and validation engine.
- **[mcp-contract-check-action](./mcp-contract-check-action/)**: GitHub Action runner packaging the CLI for CI/CD workflows.
- **[mcp-check-demo](./mcp-check-demo/)**: Example MCP server showcasing both compliant and broken contract checks.
- **[license-service](./license-service/)**: Stripe webhook and license validation microservice.

---

## License

[MIT](./LICENSE)
