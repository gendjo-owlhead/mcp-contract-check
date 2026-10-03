---
name: verify-mcp-contract-check
description: Verifies MCP server contract testing and schema validation CLI (mcp-check) in local and CI environments. Use when validating tool execution against MCP servers, testing contract pass/fail reporting, or updating CLI options.
---

# Verify MCP Contract Check

This skill drives and verifies the `mcp-check` CLI tool in `@local/mcp-contract-check`. The tool connects to MCP servers over stdio, discovers tools, evaluates fixtures or default schemas, and verifies that responses strictly match output schemas.

## Launch

Build the monorepo packages to ensure the latest TypeScript binaries are available:

```bash
npm run build
```

The CLI operates as an on-demand process over stdio. It spawns the target MCP server per test run, communicates via JSON-RPC over pipes, and exits when complete. No long-lived background server is required.

## Doctor

Perform a read-only sanity check before driving tests:

```bash
node -v && test -f mcp-contract-check/dist/cli.js && node mcp-contract-check/dist/cli.js --version
```

Expected output:
- Node.js runtime active (v20+)
- `mcp-contract-check/dist/cli.js` exists
- Version output `1.0.0` with exit code `0`

Using the helper:
```bash
.agents/skills/verify-mcp-contract-check/scripts/driver.sh test-run doctor
```

## Drive

Drive the CLI against stdio MCP servers using explicit arguments:

1. **Compliant server contract validation:**
   ```bash
   node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases
   ```
   Observable result: Exits with code `0`, prints `ok` on stdout.

2. **Contract violation detection:**
   ```bash
   node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js --broken" --cases mcp-check-demo/cases
   ```
   Observable result: Exits with code `1`, prints error report detailing `Tool: echo`, `Expected: output matching schema`, `Actual: output does not match schema`.

3. **Default schema invocation (no fixtures):**
   ```bash
   node mcp-contract-check/dist/cli.js --command "node mcp-check-demo/server.js" --cases cases-empty
   ```
   Observable result: When `--cases` points to an empty directory, tools are automatically called with `{}`.

4. **Missing required arguments:**
   ```bash
   node mcp-contract-check/dist/cli.js
   ```
   Observable result: Exits with code `1`, prints `Error: missing required option --command "<stdio server command>"`.

5. **Help and Version inspection:**
   ```bash
   node mcp-contract-check/dist/cli.js --help
   node mcp-contract-check/dist/cli.js --version
   ```

## Evidence

Verification artifacts are stored under `artifacts/verify-mcp-contract-check/<RUN_ID>/`.

Proof standards:
- Each verification run writes `<FEATURE_NAME>.log` containing the exact CLI command invoked, exit code, stdout, and stderr.
- Compliant test proofs must verify exit code `0` and exact stdout `ok`.
- Broken contract proofs must verify exit code `1` and structured report mentioning the failed tool, case file, expected schema, and actual validation error.
- All proof logs must persist across cleanup.

## Cleanup

1. Remove any temporary fixture directories or scratch server files created during custom verification scenarios.
2. Stdio child processes terminate automatically when the MCP client connection closes; verify no orphaned `server.js` or `cli.js` processes remain.
3. Never remove `artifacts/verify-mcp-contract-check/` during cleanup.

## Helpers

The driver script automates running the CLI, capturing stdout/stderr/exit code, and persisting structured proof:

```bash
.agents/skills/verify-mcp-contract-check/scripts/driver.sh <RUN_ID> <FEATURE_NAME> [CLI_ARGS...]
```

Examples:
```bash
# Doctor check
.agents/skills/verify-mcp-contract-check/scripts/driver.sh run-001 doctor

# Pass test
.agents/skills/verify-mcp-contract-check/scripts/driver.sh run-001 pass --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases

# Fail test
.agents/skills/verify-mcp-contract-check/scripts/driver.sh run-001 broken --command "node mcp-check-demo/server.js --broken" --cases mcp-check-demo/cases
```
