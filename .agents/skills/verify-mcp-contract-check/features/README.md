# MCP Contract Check verification map

This directory is the maintained source for verifying the user-facing behavior of `mcp-check` (`@local/mcp-contract-check`). Read this index before driving the tool, then follow the matching feature file as the recipe.

## Baseline preconditions

- Ensure Node.js (v20+) and dependencies are installed (`npm ci` or `npm install`).
- Monorepo packages are compiled via `npm run build`.
- `mcp-contract-check/dist/cli.js` exists and is executable via `node`.
- Set a distinct `RUN_ID` per verification run so artifacts do not overwrite prior executions.
- Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh <RUN_ID> doctor` and verify doctor output reports pass.

## Driving conventions

- Start every recipe from the baseline state.
- Run CLI commands directly via `node mcp-contract-check/dist/cli.js` or through the helper script `.agents/skills/verify-mcp-contract-check/scripts/driver.sh <RUN_ID> <FEATURE_NAME> [ARGS...]`.
- Treat command flags and quotes as literal.
- Assert both stdout/stderr output and the process exit code.
- Retain all proof artifacts in `artifacts/verify-mcp-contract-check/<RUN_ID>/` across cleanup.

## Proof and skip reporting

- CLI proof includes the full command executed, exit code, stdout, and stderr.
- Passing runs require exit code `0` and stdout `ok`.
- Failing runs require exit code `1` and a structured error block naming the tool, case file, expected schema, and actual mismatch.
- Document any skipped entry points with the exact command attempted and unmet precondition.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order:

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with driver.sh` starts with `Preconditions:` and pairs each user action with an exact command and observable result.
4. `Gotchas` lists pitfalls that could invalidate verification.

## Features

- [Contract validation pass](./contract-validation-pass.md) covers verifying a compliant MCP server against custom fixtures with exit code 0.
- [Contract violation fail](./contract-violation-fail.md) covers detecting tool output schema deviations with structured failure reports and exit code 1.
- [Default fixture check](./default-fixture-check.md) covers zero-config tool validation when no fixture directory is provided.
- [Fuzz schema generation](./fuzz-schema-generation.md) covers automatic test argument synthesis from tool input schemas via `--fuzz`.
- [Breaking change detection](./breaking-change-detection.md) covers snapshotting contracts with `--save-contract` and detecting breaking schema drift with `--baseline`.
- [Remote SSE transport](./remote-sse-transport.md) covers connecting to remote MCP servers over HTTP/SSE with `--url` and `--header`.
- [CLI help and version](./cli-help-and-version.md) covers CLI flags `--help`, `--version`, and required argument validation.
