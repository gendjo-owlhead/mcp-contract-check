# Contract violation fail

Contract violation fail verifies that when an MCP server returns a tool response that violates its declared outputSchema, `mcp-check` halts execution, outputs a structured failure report on stderr, and exits with code 1.

## Sub-features

- `fail-schema-mismatch` intercepts responses that omit required schema properties or violate data types.
- `fail-exit-one` exits with status code 1 to indicate a contract break.
- `fail-report-format` writes structured failure diagnostics containing Tool, Case, Expected, and Actual.

## How to get to it (user POV)

- Run `mcp-check --command "node mcp-check-demo/server.js --broken" --cases mcp-check-demo/cases` in a terminal.
- Run `node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js --broken" --cases mcp-check-demo/cases` from repo root.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run.
- `mcp-check-demo/server.js` supports `--broken` mode, returning `{message: "hi"}` instead of `{text: string}` for tool `echo`.
- `mcp-check-demo/cases/echo.json` defines a test case for `echo`.

- **Execute fail verification.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID fail --command "node mcp-check-demo/server.js --broken" --cases mcp-check-demo/cases`.
- **Verify exit code.** Process exit code is `1`.
- **Verify stderr.** Standard error contains:
  - `Tool: echo`
  - `Case: mcp-check-demo/cases/echo.json`
  - `Expected: output matching schema`
  - `Actual: output does not match schema` (data must have required property 'text')
- **Proof artifact.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/fail.log` to confirm the error report and non-zero exit code were captured.

## Gotchas

- The failure report is emitted to `stderr`, while `stdout` remains empty on error.
- If a tool fails before schema validation (e.g. server crash or unhandled exception), the report indicates `successful connection over stdio` or `tool not found on server` rather than schema failure.
