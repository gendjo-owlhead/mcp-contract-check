# Distribution & Growth Playbook for MCP Contract Check

Actionable channels and ready-to-use templates to acquire users for `mcp-contract-check`.

---

## 1. Directory Listings & Awesome Lists

Submit pull requests to add `mcp-contract-check` under "Testing & Tooling" or "CI/CD":

1. **[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)**
   - Section: *Frameworks*
   - Status: **PR Submitted**: [#15639](https://github.com/punkpeye/awesome-mcp-servers/pull/15639)
   - Entry: `[gendjo-owlhead/mcp-contract-check](https://github.com/gendjo-owlhead/mcp-contract-check) 📇 🏠 🍎 🪟 🐧 - Automated contract testing, schema fuzzing, and breaking change detection for MCP servers in CI/CD.`
2. **[punkpeye/awesome-mcp-devtools](https://github.com/punkpeye/awesome-mcp-devtools)**
   - Section: *Testing Tools*
   - Status: **PR Submitted**: [#358](https://github.com/punkpeye/awesome-mcp-devtools/pull/358)
   - Entry: `[gendjo-owlhead/mcp-contract-check](https://github.com/gendjo-owlhead/mcp-contract-check) 📇 🤖 - Automated contract testing, schema fuzzing, and breaking change detection for MCP servers in CI/CD (GitHub Action & CLI).`
3. **[wong2/awesome-mcp-servers](https://github.com/wong2/awesome-mcp-servers)**
4. **[modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)**
5. **[glama-ai/mcp-registry](https://glama.ai/mcp)**

---

## 2. GitHub Marketplace Discovery & Viral Loop

Every repository using `mcp-contract-check` acts as a referral channel via the embeddable badge:

```markdown
[![MCP Contract Validated](https://img.shields.io/badge/MCP%20Contract-Validated-0080ff?logo=shield)](https://github.com/gendjo-owlhead/mcp-contract-check)
```

Target open-source MCP repositories on GitHub:
- Submit quick pull requests adding the GitHub Action and badge to top open-source MCP servers (e.g. SQLite MCP, Postgres MCP, Filesystem MCP).
- Once maintainers merge the PR, their visitors and users discover `mcp-contract-check`.

---

## 3. Launch Posts & Community Announcements

### Hacker News ("Show HN")
**Title:**
> Show HN: MCP Contract Check – Schema testing & breaking change detector for MCP servers

**Body:**
> Hey HN,
>
> As more developers build Model Context Protocol (MCP) servers, we noticed a recurring headache: tool responses silently drifting away from their declared JSON Schemas, leading to hallucinations and runtime tool call failures in Claude and other agents.
>
> We built **MCP Contract Check** (GitHub Action + CLI):
> - Runs in CI over local stdio (`--command`) or remote SSE (`--url`)
> - **Schema Fuzzer**: Synthesizes valid inputs automatically from tool input schemas (no manual fixtures required to get started)
> - **Drift Detection**: Compares against contract baseline snapshots to block breaking changes (removed tools, narrowed enums, added required params)
> - **GitHub Job Summaries**: Beautiful PR report cards showing schema conformance
>
> Repo: https://github.com/gendjo-owlhead/mcp-contract-check
> Action: https://github.com/marketplace/actions/mcp-contract-check
>
> 100% free for open-source repositories. Feedback and feature suggestions welcome!

### Reddit (`r/ClaudeAI`, `r/LocalLLaMA`)
**Title:**
> We built automated contract testing and schema fuzzing for MCP servers (GitHub Action + CLI)

**Body:**
> If you build or maintain MCP tools for Claude Desktop or autonomous agents, keeping tool output schemas accurate is critical.
>
> We released `mcp-contract-check` to automate this in CI:
> 1. Tests local or remote SSE MCP servers
> 2. Fuzzes tool inputs based on JSON Schema constraints
> 3. Catches breaking API changes before they reach users
> 4. Posts rich test breakdowns directly in GitHub Actions
>
> Check it out: https://github.com/gendjo-owlhead/mcp-contract-check

### Anthropic Discord & MCP Developer Forum
Post in `#mcp-tools` and `#showcase`:
> Just launched **MCP Contract Check v1.1.0** — automated tool schema validation, fuzzing, and breaking change prevention in GitHub Actions and CLI. Free for open source: https://github.com/gendjo-owlhead/mcp-contract-check
