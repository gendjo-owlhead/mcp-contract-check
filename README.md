# MCP Contract Check

[![npm](https://img.shields.io/npm/v/mcp-contract-check.svg?color=blue&logo=npm)](https://www.npmjs.com/package/mcp-contract-check)
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
| `fail-open` | Allow CI checks to proceed with a warning if the license server is unreachable or experiences an outage. | No | `true` |

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
npx mcp-contract-check --command "node server.js" --cases cases

# Run automatic schema fuzzing without writing fixtures
npx mcp-contract-check --command "node server.js" --fuzz

# Save contract snapshot
npx mcp-contract-check --command "node server.js" --save-contract contracts/v1.json

# Check against baseline for breaking changes
npx mcp-contract-check --command "node server.js" --baseline contracts/v1.json

# Test remote SSE server with custom headers
npx mcp-contract-check --url "https://api.example.com/sse" -H "Authorization: Bearer token" --fuzz
```

---

## Licensing & Pricing

- **Public Repositories**: **100% Free Forever**. No license key or registration required.
- **Private Repositories**:
  - **14-Day Free Evaluation Trial**: Automatic in GitHub Actions. No credit card required. Private repositories run immediately and display remaining trial days in job notices.
  - **Lifetime Access Pass**: **€10 one-time payment**. [Get Lifetime Access (€10)](https://buy.stripe.com/28E00k3S02sI9n6ac20oM04). Pay once, use forever across your private repositories. Zero recurring subscriptions.
  - **Supported License Keys**: Set your Stripe billing email, Payment Intent ID (`pi_...`), Checkout Session ID (`cs_...`), or Customer ID (`cus_...`) in your GitHub repository secrets as `MCP_LICENSE_KEY`.

---

## Privacy & Data Security

`mcp-contract-check` runs locally inside your GitHub Actions runner or terminal:
- **Public Repositories**: Run completely offline without license server calls. No data is transmitted.
- **Private Repositories**: Only the repository identifier (`owner/repo`) and the license key are sent to the verification endpoint. Server code, tool schemas, fixtures, and execution results remain entirely on your runner and are never transmitted.
- **Fail-Open Protection**: If the license verification service is unreachable or encounters an outage, the action logs a warning and proceeds with testing. Your CI pipeline is never blocked by license server downtime.

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
