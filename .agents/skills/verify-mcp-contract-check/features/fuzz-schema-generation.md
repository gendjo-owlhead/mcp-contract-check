# Fuzz schema generation

Fuzz schema generation tests the `--fuzz` option, which automatically synthesizes schema-compliant arguments for all discovered MCP tools when explicit test fixtures are missing or omitted.

## Sub-features

- `fuzz-argument-synthesis` generates compliant payloads matching primitive, array, and object constraints in `inputSchema`.
- `fuzz-flag` enables fuzzing via the `--fuzz` or `-f` command-line flags.
- `fuzz-pass` exits with code 0 and reports `ok` when fuzzed payloads yield valid output responses.

## How to get to it (user POV)

- Run `mcp-check --command "node server.js" --fuzz`.
- Run `node mcp-contract-check/dist/cli.js --command "node server.js" --fuzz --cases /path/to/empty/dir`.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run.
- `mcp-check-demo/server.js` starts cleanly.

- **Execute fuzz verification.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID fuzz --command "node mcp-check-demo/server.js" --fuzz --cases /tmp/empty-cases`.
- **Verify exit code.** Process exit code is `0`.
- **Verify stdout.** Standard output contains `ok`.
- **Proof artifact.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/fuzz.log`.

## Gotchas

- If a server requires stateful session setup or database records, purely synthetic random inputs may trigger server-side business errors. In that scenario, explicit JSON fixtures should be used instead.
