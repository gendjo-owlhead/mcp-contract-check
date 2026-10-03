# MCP Contract Check

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Automated tool contract testing and JSON Schema validation for Model Context Protocol (MCP) servers in CI/CD.

`mcp-contract-check` connects to your MCP server over stdio, discovers registered tools, executes test cases or schema-driven fixtures, and fails the build immediately if any tool response deviates from its declared JSON Schema.

---

## Quickstart

Add `mcp-contract-check` to your GitHub Actions workflow:

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
          cases: "cases" # optional, defaults to cases/
          license-key: ${{ secrets.MCP_LICENSE_KEY }} # optional for public repos, required for private repos
```

---

## Action Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `command` | The stdio server command to start your MCP server (e.g. `node server.js` or `python -m my_server`). | **Yes** | — |
| `cases` | Directory containing JSON test case fixtures for tool arguments. | No | `cases` |
| `license-key` | License key required for private repositories. Not needed for public open-source repos. | No | — |

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
    }
  }
]
```

Tools without explicit fixtures are automatically invoked with `{}` to verify basic protocol compliance.

---

## Licensing & Pricing

- **Public Repositories**: **100% Free**. No license key or registration required.
- **Private Repositories**: Requires an active license.
  - **Pricing**: €29/month + VAT
  - **Subscribe**: [Buy License via Stripe](https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00)
  - Add your Stripe billing email, Subscription ID (`sub_...`), or Customer ID (`cus_...`) to your repository secrets as `MCP_LICENSE_KEY`.

---

## Monorepo Packages

This repository contains the full MCP contract testing suite:

- **[mcp-contract-check](./mcp-contract-check/)**: Core TypeScript CLI (`mcp-check`) for local command-line testing.
- **[mcp-contract-check-action](./mcp-contract-check-action/)**: GitHub Action runner packaging the CLI for CI/CD.
- **[mcp-check-demo](./mcp-check-demo/)**: Example MCP server showcasing both compliant and broken contract checks.

---

## License

[MIT](./LICENSE)
