# MCP Contract Check Action

Automated tool contract testing, schema fuzzing, and breaking change detection for Model Context Protocol (MCP) servers in GitHub Actions.

Fails the build immediately when an MCP server tool response violates its declared JSON Schema or introduces backwards-incompatible API changes.

---

## Usage

### 1. Local Stdio Server

```yaml
name: MCP Check
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          cases: "cases"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 2. Automatic Schema Fuzzing (Zero Fixtures)

```yaml
      - uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          fuzz: "true"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 3. Remote Server-Sent Events (SSE) Endpoint

```yaml
      - uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          url: "https://mcp-staging.internal/sse"
          headers: |
            Authorization: Bearer ${{ secrets.MCP_STAGING_TOKEN }}
            X-Tenant-Id: test-suite
          fuzz: "true"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

### 4. Breaking Change Detection in Pull Requests

```yaml
      - uses: gendjo-owlhead/mcp-contract-check@v1
        with:
          command: "node dist/server.js"
          baseline: "contracts/baseline.json"
          save-contract: "contracts/current.json"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

---

## Action Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `command` | The stdio server command to start your MCP server. | No* | — |
| `url` | Remote MCP server SSE endpoint URL. | No* | — |
| `headers` | Custom HTTP headers for remote SSE requests (formatted as JSON or `key: value` lines). | No | — |
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

```markdown
[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)
```

---

## Licensing

- **Public Repositories**: Completely free forever. No license key or registration required.
- **Private Repositories**:
  - **14-Day Free Evaluation Trial**: Automatic in GitHub Actions. No upfront credit card required.
  - **Lifetime Repo Pass (Most Popular)**: €79 one-time payment. Pay once, use forever for 1 private repository.
  - **Standard Subscription**: €29/month per private repository. Cancel anytime.
  - [Purchase License via Stripe](https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00)
  - Provide your Stripe billing email, Subscription ID (`sub_...`), Payment ID (`pi_...`), Checkout Session ID (`cs_...`), or Customer ID (`cus_...`) as the `license-key` input or repository secret.
