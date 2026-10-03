import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { parseCommandLine } from "./command-parser.js";
import { ContractDiff, type ContractSnapshot, type DiffResult } from "./diff.js";
import { buildCasesForTools, loadFixtures } from "./fixtures.js";
import type { CaseResult, CheckOptions, CheckSummary, FixtureCase } from "./types.js";
import { validateJsonSchema } from "./validator.js";

function extractOutputData(result: Record<string, unknown>): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  // If content contains a text block that is valid JSON, try to parse it
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item && typeof item === "object" && item.type === "text" && typeof item.text === "string") {
        try {
          return JSON.parse(item.text);
        } catch {
          // not JSON, continue
        }
      }
    }
  }

  // Check if result has keys other than content, _meta, isError
  const standardKeys = new Set(["content", "_meta", "isError"]);
  const customKeys = Object.keys(result).filter((k) => !standardKeys.has(k));
  if (customKeys.length > 0) {
    const customObj: Record<string, unknown> = {};
    for (const k of customKeys) {
      customObj[k] = result[k];
    }
    return customObj;
  }

  return result;
}

export function formatReport(results: CaseResult[]): string {
  const failed = results.filter((r) => !r.passed);
  if (failed.length === 0) {
    return "ok";
  }

  return failed
    .map(
      (f) =>
        `Tool: ${f.tool}\nCase: ${f.caseFile}\nExpected: ${f.expected}\nActual: ${f.actual}`
    )
    .join("\n\n");
}

export async function runContractCheck(options: CheckOptions): Promise<CheckSummary> {
  const { casesDir = "cases", timeoutMs = 30000 } = options;
  const results: CaseResult[] = [];
  let diffResult: DiffResult | undefined;

  let transport: Transport;
  let getStderrLog = (): string => "";

  if (options.url) {
    let urlObj: URL;
    try {
      urlObj = new URL(options.url);
    } catch {
      return {
        success: false,
        totalCases: 0,
        passedCases: 0,
        failedCases: 1,
        results: [
          {
            tool: "(server)",
            caseFile: "(none)",
            expected: "valid server URL",
            actual: `Invalid URL: ${options.url}`,
            passed: false,
          },
        ],
        report: `Tool: (server)\nCase: (none)\nExpected: valid server URL\nActual: Invalid URL: ${options.url}`,
      };
    }

    transport = new SSEClientTransport(urlObj, {
      requestInit: options.headers ? { headers: options.headers } : undefined,
    });
  } else if (options.command) {
    let parsed: { command: string; args: string[] };
    try {
      parsed = parseCommandLine(options.command);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        totalCases: 0,
        passedCases: 0,
        failedCases: 1,
        results: [
          {
            tool: "(server)",
            caseFile: "(none)",
            expected: "valid server command",
            actual: message,
            passed: false,
          },
        ],
        report: `Tool: (server)\nCase: (none)\nExpected: valid server command\nActual: ${message}`,
      };
    }

    const stdioTransport = new StdioClientTransport({
      command: parsed.command,
      args: parsed.args,
      stderr: "pipe",
    });

    const stderrChunks: Buffer[] = [];
    stdioTransport.stderr?.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    getStderrLog = (): string => {
      const raw = Buffer.concat(stderrChunks).toString("utf-8").trim();
      return raw ? `\nServer stderr:\n${raw}` : "";
    };

    transport = stdioTransport;
  } else {
    return {
      success: false,
      totalCases: 0,
      passedCases: 0,
      failedCases: 1,
      results: [
        {
          tool: "(server)",
          caseFile: "(none)",
          expected: "server command or URL",
          actual: "Missing both command and url options",
          passed: false,
        },
      ],
      report: `Tool: (server)\nCase: (none)\nExpected: server command or URL\nActual: Missing both command and url options`,
    };
  }

  const client = new Client(
    { name: "mcp-contract-check", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    try {
      await client.connect(transport);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stderrLog = getStderrLog();
      return {
        success: false,
        totalCases: 0,
        passedCases: 0,
        failedCases: 1,
        results: [
          {
            tool: "(server)",
            caseFile: "(none)",
            expected: options.url ? "successful connection over SSE" : "successful connection over stdio",
            actual: `failed to connect to server: ${message}${stderrLog}`,
            passed: false,
          },
        ],
        report: `Tool: (server)\nCase: (none)\nExpected: ${options.url ? "successful connection over SSE" : "successful connection over stdio"}\nActual: failed to connect to server: ${message}${stderrLog}`,
      };
    }

    let tools: Array<{
      name: string;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
    }> = [];

    try {
      const listRes = await client.listTools();
      tools = (listRes.tools ?? []) as typeof tools;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        totalCases: 0,
        passedCases: 0,
        failedCases: 1,
        results: [
          {
            tool: "(server)",
            caseFile: "(none)",
            expected: "successful listTools response",
            actual: `failed to list tools: ${message}`,
            passed: false,
          },
        ],
        report: `Tool: (server)\nCase: (none)\nExpected: successful listTools response\nActual: failed to list tools: ${message}`,
      };
    }

    if (options.saveContract) {
      const snapshot = ContractDiff.createSnapshot(tools);
      const targetPath = path.resolve(process.cwd(), options.saveContract);
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), "utf-8");
    }

    if (options.baseline) {
      const baselinePath = path.resolve(process.cwd(), options.baseline);
      if (!fs.existsSync(baselinePath)) {
        return {
          success: false,
          totalCases: 0,
          passedCases: 0,
          failedCases: 1,
          results: [
            {
              tool: "(baseline)",
              caseFile: options.baseline,
              expected: "existing baseline file",
              actual: `baseline snapshot not found at ${options.baseline}`,
              passed: false,
            },
          ],
          report: `Tool: (baseline)\nCase: ${options.baseline}\nExpected: existing baseline file\nActual: baseline snapshot not found at ${options.baseline}`,
        };
      }

      let baselineSnapshot: ContractSnapshot;
      try {
        const raw = fs.readFileSync(baselinePath, "utf-8");
        baselineSnapshot = JSON.parse(raw);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          totalCases: 0,
          passedCases: 0,
          failedCases: 1,
          results: [
            {
              tool: "(baseline)",
              caseFile: options.baseline,
              expected: "valid JSON baseline snapshot",
              actual: `failed to parse baseline JSON: ${message}`,
              passed: false,
            },
          ],
          report: `Tool: (baseline)\nCase: ${options.baseline}\nExpected: valid JSON baseline snapshot\nActual: failed to parse baseline JSON: ${message}`,
        };
      }

      diffResult = ContractDiff.compare(baselineSnapshot, tools);
      if (!diffResult.compatible) {
        const diffReport = ContractDiff.formatReport(diffResult);
        return {
          success: false,
          totalCases: diffResult.issues.length,
          passedCases: diffResult.nonBreakingCount,
          failedCases: diffResult.breakingCount,
          diff: diffResult,
          results: diffResult.issues.map((i) => ({
            tool: i.tool,
            caseFile: options.baseline || "baseline",
            expected: "backward-compatible contract",
            actual: `[${i.severity.toUpperCase()}] ${i.message}`,
            passed: i.severity === "non-breaking",
          })),
          report: diffReport,
        };
      }
    }

    const loaded = loadFixtures(casesDir);
    const testCases: FixtureCase[] = buildCasesForTools(tools, loaded, { fuzz: options.fuzz });

    for (const testCase of testCases) {
      const toolDef = tools.find((t) => t.name === testCase.tool);

      if (!toolDef) {
        results.push({
          tool: testCase.tool,
          caseFile: testCase.caseFile,
          expected: testCase.expected === "fail" ? "fail" : "success",
          actual: "tool not found on server",
          passed: false,
        });
        continue;
      }

      // Check input schema before calling tool
      if (toolDef.inputSchema) {
        const inputValidation = validateJsonSchema(
          toolDef.inputSchema,
          testCase.arguments ?? {}
        );
        if (!inputValidation.valid) {
          results.push({
            tool: testCase.tool,
            caseFile: testCase.caseFile,
            expected: "valid arguments matching input schema",
            actual: `fixture error: arguments do not match input schema: ${inputValidation.errors.join(", ")}`,
            passed: false,
          });
          continue;
        }
      }

      const isExpectFail = testCase.expected === "fail";

      try {
        const callResult = (await client.callTool(
          {
            name: testCase.tool,
            arguments: testCase.arguments ?? {},
          },
          undefined,
          { timeout: timeoutMs }
        )) as Record<string, unknown>;

        if (callResult.isError === true) {
          const errorDetail = Array.isArray(callResult.content)
            ? callResult.content
                .map((c: any) =>
                  c && typeof c === "object" && typeof c.text === "string" ? c.text : ""
                )
                .filter(Boolean)
                .join("\n")
            : "";
          const errorMsg = errorDetail
            ? `tool returned error: ${errorDetail}`
            : "tool returned error";

          if (isExpectFail) {
            results.push({
              tool: testCase.tool,
              caseFile: testCase.caseFile,
              expected: "fail",
              actual: "tool returned error as expected",
              passed: true,
            });
          } else {
            results.push({
              tool: testCase.tool,
              caseFile: testCase.caseFile,
              expected: "success",
              actual: errorMsg,
              passed: false,
            });
          }
          continue;
        }

        if (isExpectFail) {
          results.push({
            tool: testCase.tool,
            caseFile: testCase.caseFile,
            expected: "fail",
            actual: "call succeeded unexpectedly",
            passed: false,
          });
          continue;
        }

        // Validate output schema if defined
        if (toolDef.outputSchema) {
          const outputData = extractOutputData(callResult);
          const outputValidation = validateJsonSchema(toolDef.outputSchema, outputData);

          if (!outputValidation.valid) {
            results.push({
              tool: testCase.tool,
              caseFile: testCase.caseFile,
              expected: "output matching schema",
              actual: `output does not match schema: ${outputValidation.errors.join(", ")}`,
              passed: false,
            });
            continue;
          }
        }

        results.push({
          tool: testCase.tool,
          caseFile: testCase.caseFile,
          expected: "success",
          actual: "ok",
          passed: true,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        if (isExpectFail) {
          results.push({
            tool: testCase.tool,
            caseFile: testCase.caseFile,
            expected: "fail",
            actual: `call failed as expected: ${message}`,
            passed: true,
          });
        } else {
          const isSchemaError =
            Boolean(toolDef.outputSchema) &&
            (message.includes("output schema") ||
              message.includes("Structured content") ||
              message.includes("structured content"));

          results.push({
            tool: testCase.tool,
            caseFile: testCase.caseFile,
            expected: isSchemaError ? "output matching schema" : "success",
            actual: isSchemaError ? `output does not match schema: ${message}` : message,
            passed: false,
          });
        }
      }
    }
  } finally {
    try {
      await client.close();
    } catch {
      // ignore
    }
    try {
      await transport.close();
    } catch {
      // ignore
    }
  }

  const passedCases = results.filter((r) => r.passed).length;
  const failedCases = results.length - passedCases;
  const success = failedCases === 0;

  return {
    success,
    totalCases: results.length,
    passedCases,
    failedCases,
    results,
    diff: diffResult,
    report: formatReport(results),
  };
}
