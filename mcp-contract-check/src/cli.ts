#!/usr/bin/env node
import { runContractCheck } from "./checker.js";

function parseArgs(args: string[]): {
  command?: string;
  url?: string;
  transport?: "auto" | "sse" | "streamable-http";
  headers?: Record<string, string>;
  cases?: string;
  fuzz?: boolean;
  baseline?: string;
  saveContract?: string;
  help?: boolean;
  version?: boolean;
} {
  const result: {
    command?: string;
    url?: string;
    transport?: "auto" | "sse" | "streamable-http";
    headers?: Record<string, string>;
    cases?: string;
    fuzz?: boolean;
    baseline?: string;
    saveContract?: string;
    help?: boolean;
    version?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--fuzz" || arg === "-f") {
      result.fuzz = true;
    } else if (arg === "--command" || arg === "-c") {
      result.command = args[++i];
    } else if (arg.startsWith("--command=")) {
      result.command = arg.slice("--command=".length);
    } else if (arg === "--url" || arg === "-u") {
      result.url = args[++i];
    } else if (arg.startsWith("--url=")) {
      result.url = arg.slice("--url=".length);
    } else if (arg === "--transport" || arg === "-t") {
      result.transport = args[++i] as any;
    } else if (arg.startsWith("--transport=")) {
      result.transport = arg.slice("--transport=".length) as any;
    } else if (arg === "--header" || arg === "-H") {
      const headerStr = args[++i];
      if (headerStr) {
        const colonIdx = headerStr.indexOf(":");
        if (colonIdx > 0) {
          const key = headerStr.slice(0, colonIdx).trim();
          const val = headerStr.slice(colonIdx + 1).trim();
          result.headers = result.headers || {};
          result.headers[key] = val;
        }
      }
    } else if (arg.startsWith("--header=")) {
      const headerStr = arg.slice("--header=".length);
      const colonIdx = headerStr.indexOf(":");
      if (colonIdx > 0) {
        const key = headerStr.slice(0, colonIdx).trim();
        const val = headerStr.slice(colonIdx + 1).trim();
        result.headers = result.headers || {};
        result.headers[key] = val;
      }
    } else if (arg === "--cases" || arg === "-d") {
      result.cases = args[++i];
    } else if (arg.startsWith("--cases=")) {
      result.cases = arg.slice("--cases=".length);
    } else if (arg === "--baseline" || arg === "-b") {
      result.baseline = args[++i];
    } else if (arg.startsWith("--baseline=")) {
      result.baseline = arg.slice("--baseline=".length);
    } else if (arg === "--save-contract" || arg === "-s") {
      result.saveContract = args[++i];
    } else if (arg.startsWith("--save-contract=")) {
      result.saveContract = arg.slice("--save-contract=".length);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    console.log(`mcp-check - Model Context Protocol tool contract testing

Usage:
  mcp-check (--command "<stdio server command>" | --url "<remote url>") [options]

Options:
  -c, --command <cmd>        The stdio server command to start your MCP server
  -u, --url <url>            Remote MCP server endpoint URL (e.g. http://localhost:8080/sse or http://localhost:8080/mcp)
  -t, --transport <type>     Remote transport protocol: auto, sse, streamable-http (default: auto)
  -H, --header <key:val>     HTTP header to pass with remote requests (can be specified multiple times)
  -d, --cases <dir>          Directory containing test case fixtures (default: "cases")
  -f, --fuzz                 Synthesize valid arguments from tool input schemas when fixtures are missing
  -b, --baseline <file>      Fail if server contracts introduce breaking changes against baseline JSON
  -s, --save-contract <file> Save discovered server tool contracts to a JSON snapshot file
  -h, --help                 Show this help message
  -v, --version              Show version number
`);
    process.exit(0);
  }

  if (parsed.version) {
    console.log("1.1.0");
    process.exit(0);
  }

  if (!parsed.command && !parsed.url) {
    console.error('Error: missing required target option. Specify either --command "<cmd>" or --url "<url>"');
    console.error('Usage: mcp-check (--command "<stdio server command>" | --url "<remote url>") [options]');
    process.exit(1);
  }

  const result = await runContractCheck({
    command: parsed.command,
    url: parsed.url,
    transport: parsed.transport,
    headers: parsed.headers,
    casesDir: parsed.cases ?? "cases",
    fuzz: Boolean(parsed.fuzz),
    baseline: parsed.baseline,
    saveContract: parsed.saveContract,
  });

  if (result.success) {
    console.log("ok");
    process.exit(0);
  } else {
    console.error(result.report);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
