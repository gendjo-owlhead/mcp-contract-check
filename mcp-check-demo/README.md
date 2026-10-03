# mcp-check-demo

A minimal stdio MCP server with one tool named `echo`.
Declared output schema requires `{ "text": string }`.

## Commands

### Check Broken Server (exits 1)
Broken handler returns `{ "message": "hi" }` which fails validation:
```bash
npm run check:broken
# Exit code: 1
```

### Check Fixed Server (exits 0)
Fixed handler returns `{ "text": "hi" }` which satisfies schema:
```bash
npm run check:fixed
# Output: ok
# Exit code: 0
```
