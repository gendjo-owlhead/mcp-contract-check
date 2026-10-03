#!/usr/bin/env node
import { runContractCheck } from "./checker.js";
function parseArgs(args) {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            result.help = true;
        }
        else if (arg === "--version" || arg === "-v") {
            result.version = true;
        }
        else if (arg === "--fuzz" || arg === "-f") {
            result.fuzz = true;
        }
        else if (arg === "--command" || arg === "-c") {
            result.command = args[++i];
        }
        else if (arg.startsWith("--command=")) {
            result.command = arg.slice("--command=".length);
        }
        else if (arg === "--cases" || arg === "-d") {
            result.cases = args[++i];
        }
        else if (arg.startsWith("--cases=")) {
            result.cases = arg.slice("--cases=".length);
        }
    }
    return result;
}
async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.help) {
        console.log(`mcp-check - Model Context Protocol tool contract testing

Usage:
  mcp-check --command "<stdio server command>" [--cases <dir>] [--fuzz]

Options:
  -c, --command <cmd>    The stdio server command to start your MCP server (required)
  -d, --cases <dir>      Directory containing test case fixtures (default: "cases")
  -f, --fuzz             Synthesize valid arguments from tool input schemas when fixtures are missing
  -h, --help             Show this help message
  -v, --version          Show version number
`);
        process.exit(0);
    }
    if (parsed.version) {
        console.log("1.0.0");
        process.exit(0);
    }
    if (!parsed.command) {
        console.error('Error: missing required option --command "<stdio server command>"');
        console.error('Usage: mcp-check --command "<stdio server command>" [--cases <dir>] [--fuzz]');
        process.exit(1);
    }
    const result = await runContractCheck({
        command: parsed.command,
        casesDir: parsed.cases ?? "cases",
        fuzz: Boolean(parsed.fuzz),
    });
    if (result.success) {
        console.log("ok");
        process.exit(0);
    }
    else {
        console.error(result.report);
        process.exit(1);
    }
}
main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
});
