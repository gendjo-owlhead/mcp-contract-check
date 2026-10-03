# Remote SSE transport

Remote SSE transport verifies connecting to and contract-testing remote or containerized MCP servers over HTTP/SSE via `--url` and custom headers via `--header`.

## Sub-features

- `remote-url-flag` specifies an HTTP/SSE server endpoint (`--url` or `-u`).
- `remote-header-flag` attaches custom authentication or routing headers (`--header` or `-H`).
- `remote-invalid-url` validates URL structure and reports formatting errors.

## How to get to it (user POV)

- Run `mcp-check --url "http://localhost:8080/sse"`.
- Run `mcp-check --url "https://api.example.com/sse" --header "Authorization: Bearer my-token"`.

## Driving it with driver.sh

Preconditions:

- `npm run build` has run.

- **Check invalid URL error.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID remote-invalid-url --url "not-a-valid-url"`. Exit code is `1`, stderr reports `Invalid URL: not-a-valid-url`.
- **Check missing target error.** Run `.agents/skills/verify-mcp-contract-check/scripts/driver.sh $RUN_ID remote-missing-target`. Exit code is `1`, stderr reports `missing required target option`.
- **Proof artifacts.** Inspect `artifacts/verify-mcp-contract-check/$RUN_ID/remote-invalid-url.log` and `remote-missing-target.log`.

## Gotchas

- Remote servers must implement standard MCP Server-Sent Events (`text/event-stream`) endpoints.
- When passing headers with spaces, wrap the entire header argument in quotes (e.g. `--header "Authorization: Bearer token"`).
