# mcp-contract-check

Tool contract testing and JSON schema validation for Model Context Protocol (MCP) stdio servers.

## Monorepo Packages

- [mcp-contract-check](./mcp-contract-check/): TypeScript CLI (`@local/mcp-contract-check` / `mcp-check`) that connects to an MCP server over stdio, tests tools with fixtures, and validates responses against declared JSON schemas.
- [mcp-check-demo](./mcp-check-demo/): Minimal stdio MCP server demonstration featuring broken and fixed contract checks.
- [mcp-contract-check-action](./mcp-contract-check-action/): GitHub Action for automated MCP schema verification in CI workflows.

## License

[MIT](./LICENSE)
