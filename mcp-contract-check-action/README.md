# MCP Contract Check Action

Fails a GitHub Actions build when an MCP tool response does not match its schema.

## Usage

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
      - uses: gendzaj/mcp-contract-check-action@v1
        with:
          command: "node server.js"
          cases: "cases"
          license-key: ${{ secrets.MCP_LICENSE_KEY }}
```

## Licensing

Public repositories run completely free with no license key required.
Paid license for private repos (€29/month + VAT): https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00
