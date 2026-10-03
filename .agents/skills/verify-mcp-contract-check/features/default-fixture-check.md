# Default fixture check

Default fixture check tests that when no fixtures are explicitly defined or `--cases` points to an empty directory, `mcp-check` discovers all tools on the server, generates an empty arguments payload (`{}`) for each tool, and validates that tools return valid output without crashing.

## Sub-features

- `default-empty-args` automatically constructs `{}` argument objects for discovered tools.
- `default-fallback` defaults `--cases` to `cases` if the option is omitted.
- `default-tool-discovery` queries the MCP server's `listTools` API to locate all declared tools.

## How to get to it (user POV)

- Run `mcp-check --command "node mcp-check-demo/server.js"` without `--cases`.
- Run `node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js" --cases /path/to/empty/dir`.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run.
- `mcp-check-demo/server.js` exposes the `echo` tool.

- **Execute default check.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID default --command "node mcp-check-demo/server.js"`.
- **Verify exit code.** Process exit code is `0`.
- **Verify stdout.** Output is `ok`.
- **Proof artifact.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/default.log`.

## Gotchas

- If a tool defines required properties in its `inputSchema`, calling it with `{}` will cause a schema validation error before execution unless a fixture is provided.
- If the target server has zero registered tools, `mcp-check` still exits 0 with `ok`.
