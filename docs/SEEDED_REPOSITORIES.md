# Outbound Seeding Directory: Top MCP Community Repositories

This document coordinates outbound adoption PRs to top open-source Model Context Protocol servers. Adding contract validation to these repositories protects downstream agent developers while establishing `gendjo-owlhead/mcp-contract-check` as the standard QA badge in the MCP ecosystem.

---

## 🎯 Target Repositories

| Repository | Stack | Transport | Command / Entrypoint | Status |
|---|---|---|---|---|
| `haris-musa/excel-mcp-server` | Python / uv | stdio | `uv run excel-mcp-server` | **PR Submitted**: [#173](https://github.com/haris-musa/excel-mcp-server/pull/173) |
| `modelcontextprotocol/servers` (sqlite) | TypeScript | stdio | `node packages/server-sqlite/dist/index.js test.db` | Ready to Submit |
| `modelcontextprotocol/servers` (memory) | TypeScript | stdio | `node packages/server-memory/dist/index.js` | Ready to Submit |
| `modelcontextprotocol/servers` (filesystem) | TypeScript | stdio | `node packages/server-filesystem/dist/index.js /tmp` | Ready to Submit |
| `modelcontextprotocol/servers` (fetch) | Python | stdio | `python -m mcp_server_fetch` | Ready to Submit |
| `modelcontextprotocol/servers` (postgres) | TypeScript | stdio | `node packages/server-postgres/dist/index.js` | Ready to Submit |
| `modelcontextprotocol/servers` (git) | Python | stdio | `python -m mcp_server_git` | Ready to Submit |
| `github/github-mcp-server` | Go / Docker | stdio | `docker run --rm -i github-mcp-server` | Ready to Submit |
| `cloudflare/mcp-server-cloudflare` | TypeScript | stdio | `node dist/index.js` | Ready to Submit |

---

## 🚀 Execution Workflow

To scaffold a contribution for any repository:

```bash
# Clone target repository
git clone https://github.com/<owner>/<repo>.git /tmp/target-repo
cd /tmp/target-repo

# Run the scaffold generator from mcp-contract-check
/path/to/mcp-contract-check/scripts/seed-mcp-repos.sh . node "node dist/index.js"

# Create branch & commit
git checkout -b ci/add-mcp-contract-check
git add .github/workflows/mcp-contract-check.yml README.md
git commit -m "ci: add automated MCP contract testing and schema fuzzing"

# Push and open PR
gh pr create \
  --title "ci: add automated MCP contract testing and schema fuzzing" \
  --body-file - < <(cat <<'EOF'
### Summary
This PR adds automated Model Context Protocol contract testing and schema fuzzing to CI using `gendjo-owlhead/mcp-contract-check@v1`.

### Key Benefits
- **Automatic Schema Fuzzing:** Synthesizes boundary and negative payloads directly from tool input schemas without needing manual fixtures.
- **Breaking Change Detection:** Protects downstream agent builders (Claude, Cursor, Antigravity) from unexpected schema regressions.
- **Community Transparency:** Adds a validated badge to `README.md`.
EOF
)
```

---

## 🛡️ Embeddable Shield Badge

All seeded repositories display the validated badge:

```markdown
[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)
```
