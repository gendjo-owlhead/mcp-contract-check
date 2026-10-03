# Contract validation pass

Contract validation pass confirms that an MCP server whose tool inputs and outputs strictly conform to their declared JSON Schema passes testing with an exit code of 0 and outputs `ok`.

## Sub-features

- `pass-standard-fixture` executes tools specified in fixture files and verifies their responses match outputSchema.
- `pass-exit-zero` exits with status code 0 when all test cases succeed.
- `pass-stdout-ok` writes a single `ok` line to standard output upon success.

## How to get to it (user POV)

- Run `mcp-check --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases` in a terminal.
- Run `node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases` from repo root.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run and built `mcp-contract-check/dist/cli.js`.
- `mcp-check-demo/server.js` starts cleanly and handles the `echo` tool.
- `mcp-check-demo/cases/echo.json` contains valid arguments (`{"text": "hi"}`) for `echo`.

- **Execute pass verification.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID pass --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases`.
- **Verify exit code.** Process exit code is `0`.
- **Verify stdout.** Standard output contains `ok`.
- **Verify stderr.** Standard error is empty.
- **Proof artifact.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/pass.log` to verify that command, exit code `0`, and stdout `ok` were persisted.

## Gotchas

- When `--command` includes arguments, the entire command string must be enclosed in quotes (e.g. `--command "node server.js"`).
- Relative paths for `--cases` are resolved relative to the working directory of the executing shell.
- Any unhandled exception in the target MCP server during tool execution will fail the contract check.
