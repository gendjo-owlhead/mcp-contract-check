# mcp-contract-check

`mcp-contract-check` connects to Model Context Protocol (MCP) servers over stdio or remote HTTP Server-Sent Events (SSE), discovers registered tools, executes test cases or synthesized arguments, and validates responses against declared JSON Schemas.

It also supports automatic schema fuzzing and breaking change detection against baseline contract snapshots.

---

## Installation & CLI Usage

Run directly via `npx` or add to your project dependencies:

```bash
# Basic run with stdio server
npx mcp-contract-check --command "<stdio server command>" --cases <dir>

# Run with automatic schema fuzzing
npx mcp-contract-check --command "<stdio server command>" --fuzz

# Save contract snapshot
npx mcp-contract-check --command "<stdio server command>" --save-contract <path>

# Verify against baseline contract
npx mcp-contract-check --command "<stdio server command>" --baseline <path>

# Test remote SSE server with custom headers
npx mcp-contract-check --url "<sse url>" -H "Authorization: Bearer <token>"
```

---

## Command Line Options

| Option | Flag | Description |
|---|---|---|
| `--command` | `-c` | The stdio server command to start your MCP server. |
| `--url` | `-u` | Remote MCP server SSE endpoint URL (e.g. `http://localhost:8080/sse`). |
| `--header` | `-H` | Custom HTTP header for remote SSE requests. Can be specified multiple times. |
| `--cases` | `-d` | Directory containing test case fixtures (default: `"cases"`). |
| `--fuzz` | `-f` | Automatically synthesize valid arguments from tool input schemas when fixtures are missing. |
| `--baseline` | `-b` | Fail if server contracts introduce breaking changes against a baseline JSON snapshot. |
| `--save-contract` | `-s` | Save discovered tool contracts to a JSON snapshot file. |
| `--help` | `-h` | Show help message. |
| `--version` | `-v` | Show version number. |

---

## Core Capabilities

### 1. Schema Fuzzing (`--fuzz`)

When `--fuzz` is passed, `mcp-contract-check` inspects the `inputSchema` of every tool and generates valid arguments that satisfy:

- Declared parameter types (`string`, `number`, `integer`, `boolean`, `array`, `object`).
- Schema defaults (`default` field).
- Allowed enum values (`enum`).
- String formats (`email`, `uri`, `date-time`, `uuid`).
- Numeric boundaries (`minimum`, `maximum`).

This allows instantaneous testing without writing manual fixtures.

### 2. Breaking Change Detection (`--baseline`)

Catch API regressions before releasing changes to MCP clients. The checker flags breaking changes:

- Removed tools.
- Newly required input properties.
- Narrowed enum values in tool inputs.
- Removed properties from structured output schemas.

Non-breaking changes (such as new tools or new optional input fields) produce informational notices without failing the build.

### 3. Remote SSE Transport (`--url`)

Test MCP servers hosted in remote staging or production environments using SSE transport:

```bash
mcp-check --url "https://mcp.example.com/sse" \
  -H "Authorization: Bearer token123" \
  -H "X-Project-Id: test-proj" \
  --fuzz
```

---

## Fixture Format

Store test fixtures as JSON files inside your cases directory (e.g. `cases/echo.json`):

```json
[
  {
    "tool": "echo",
    "arguments": { "text": "hello" },
    "expected": "success"
  },
  {
    "tool": "echo",
    "arguments": { "text": 123 },
    "expected": "fail"
  }
]
```

- `tool`: Target tool name.
- `arguments`: JSON payload passed to the tool.
- `expected`: Either `"success"` (tool output must validate against `outputSchema`) or `"fail"` (expects tool execution error).

The checker rejects invalid fixture arguments before invoking the tool, ensuring test cases remain strictly typed.

---

## Exit Codes

- `0`: All tool responses conform to schema and all contract checks passed. Outputs `ok`.
- `1`: Contract violation, breaking change detected, or server failure. Prints formatted failure report to stderr.
