# Breaking change detection

Breaking change detection tests contract snapshotting (`--save-contract`) and drift detection (`--baseline`), ensuring that backwards-incompatible API changes (removed tools, added required properties, narrowed enums, and removed output properties) are caught and reported in CI.

## Sub-features

- `snapshot-export` serializes discovered tools, descriptions, input schemas, and output schemas to a JSON snapshot file via `--save-contract`.
- `baseline-pass` verifies compatibility against an identical baseline, exiting 0 with `ok`.
- `baseline-fail` catches breaking changes against an existing baseline, exiting 1 with a formatted breakdown of breaking changes.

## How to get to it (user POV)

- Snapshot contract: `mcp-check --command "<cmd>" --save-contract <path>`.
- Verify against baseline: `mcp-check --command "<cmd>" --baseline <path>`.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run.
- `mcp-check-demo/server.js` starts cleanly.

- **Save snapshot.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID save-snapshot --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases --save-contract /tmp/demo-snapshot-$RUN_ID.json`.
- **Verify exit code.** Process exit code is `0`.
- **Verify matching baseline.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID baseline-pass --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases --baseline /tmp/demo-snapshot-$RUN_ID.json`. Exit code is `0`, stdout is `ok`.
- **Verify broken baseline.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID baseline-fail --command "node mcp-check-demo/server.js" --cases mcp-check-demo/cases --baseline /tmp/broken-baseline.json`. Exit code is `1`, stderr reports `CONTRACT BREAKING CHANGES`.
- **Proof artifacts.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/save-snapshot.log`, `baseline-pass.log`, and `baseline-fail.log`.

## Gotchas

- Baseline file paths must point to valid JSON snapshots created with `--save-contract` or compatible format.
- Adding new tools or optional parameters is classified as non-breaking and does not fail the build.
