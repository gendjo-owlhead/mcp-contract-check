# mcp-contract-check

`mcp-contract-check` connects to an MCP server over stdio using `@modelcontextprotocol/sdk`, discovers all available tools, executes test cases against them, and validates tool responses against each tool's declared JSON Schema.

## Usage

```bash
npx @local/mcp-contract-check --command "<stdio server command>" --cases <dir>
```

If `--cases` is omitted, it defaults to the `cases` directory.
If no fixture exists for a tool, it is called once with an empty arguments object `{}` and expected to return a schema-valid success.

## Fixture Format

Place test cases in `<cases>/*.json`:

```json
{
  "tool": "echo",
  "arguments": { "text": "hello" },
  "expected": "success"
}
```

- `tool`: name of the tool to invoke.
- `arguments`: argument payload passed to the tool.
- `expected`: `"success"` (default) or `"fail"` (expects error).

The checker rejects calls whose arguments violate the tool's declared input schema prior to invocation, reporting a fixture error. Exits 0 with `ok` on success, or 1 with a short failure report.
