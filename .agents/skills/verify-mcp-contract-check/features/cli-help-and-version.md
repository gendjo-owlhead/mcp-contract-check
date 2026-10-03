# CLI help and version

CLI help and version verifies that `mcp-check` displays actionable help instructions with `--help`, reports its release version with `--version`, and returns an informative error when the mandatory `--command` parameter is absent.

## Sub-features

- `cli-help-flag` displays command usage, available options, and exits 0.
- `cli-version-flag` outputs the current semver number and exits 0.
- `cli-missing-command` fails fast with an error message and exits 1 if `--command` is omitted.

## How to get to it (user POV)

- Run `mcp-check --help` or `mcp-check -h`.
- Run `mcp-check --version` or `mcp-check -v`.
- Run `mcp-check` with no flags.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run and generated `mcp-contract-check/dist/cli.js`.

- **Check help.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID help --help`. Exit code is `0`, output describes options `-c, --command` and `-d, --cases`.
- **Check version.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID version --version`. Exit code is `0`, stdout contains `1.0.0`.
- **Check missing command.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID missing-cmd`. Exit code is `1`, stderr reports `Error: missing required option --command "<stdio server command>"`.
- **Proof artifacts.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/help.log`, `version.log`, and `missing-cmd.log`.

## Gotchas

- Calling `mcp-check` without `--command` or `--help`/`--version` will always exit with code 1.
- Both short flags (`-c`, `-d`, `-h`, `-v`) and long flags (`--command`, `--cases`, `--help`, `--version`) are supported.
