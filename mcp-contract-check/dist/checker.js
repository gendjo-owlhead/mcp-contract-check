import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parseCommandLine } from "./command-parser.js";
import { buildCasesForTools, loadFixtures } from "./fixtures.js";
import { validateJsonSchema } from "./validator.js";
function extractOutputData(result) {
    if (result.structuredContent !== undefined) {
        return result.structuredContent;
    }
    // If content contains a text block that is valid JSON, try to parse it
    if (Array.isArray(result.content)) {
        for (const item of result.content) {
            if (item && typeof item === "object" && item.type === "text" && typeof item.text === "string") {
                try {
                    return JSON.parse(item.text);
                }
                catch {
                    // not JSON, continue
                }
            }
        }
    }
    // Check if result has keys other than content, _meta, isError
    const standardKeys = new Set(["content", "_meta", "isError"]);
    const customKeys = Object.keys(result).filter((k) => !standardKeys.has(k));
    if (customKeys.length > 0) {
        const customObj = {};
        for (const k of customKeys) {
            customObj[k] = result[k];
        }
        return customObj;
    }
    return result;
}
export function formatReport(results) {
    const failed = results.filter((r) => !r.passed);
    if (failed.length === 0) {
        return "ok";
    }
    return failed
        .map((f) => `Tool: ${f.tool}\nCase: ${f.caseFile}\nExpected: ${f.expected}\nActual: ${f.actual}`)
        .join("\n\n");
}
export async function runContractCheck(options) {
    const { command: commandStr, casesDir = "cases", timeoutMs = 30000 } = options;
    const results = [];
    let parsed;
    try {
        parsed = parseCommandLine(commandStr);
    }
    catch (err) {
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
    const transport = new StdioClientTransport({
        command: parsed.command,
        args: parsed.args,
        stderr: "pipe",
    });
    const stderrChunks = [];
    transport.stderr?.on("data", (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    const getStderrLog = () => {
        const raw = Buffer.concat(stderrChunks).toString("utf-8").trim();
        return raw ? `\nServer stderr:\n${raw}` : "";
    };
    const client = new Client({ name: "mcp-contract-check", version: "1.0.0" }, { capabilities: {} });
    try {
        try {
            await client.connect(transport);
        }
        catch (err) {
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
                        expected: "successful connection over stdio",
                        actual: `failed to connect to server: ${message}${stderrLog}`,
                        passed: false,
                    },
                ],
                report: `Tool: (server)\nCase: (none)\nExpected: successful connection over stdio\nActual: failed to connect to server: ${message}${stderrLog}`,
            };
        }
        let tools = [];
        try {
            const listRes = await client.listTools();
            tools = (listRes.tools ?? []);
        }
        catch (err) {
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
        const loaded = loadFixtures(casesDir);
        const testCases = buildCasesForTools(tools, loaded);
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
                const inputValidation = validateJsonSchema(toolDef.inputSchema, testCase.arguments ?? {});
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
                const callResult = (await client.callTool({
                    name: testCase.tool,
                    arguments: testCase.arguments ?? {},
                }, undefined, { timeout: timeoutMs }));
                if (callResult.isError === true) {
                    const errorDetail = Array.isArray(callResult.content)
                        ? callResult.content
                            .map((c) => c && typeof c === "object" && typeof c.text === "string" ? c.text : "")
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
                    }
                    else {
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
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (isExpectFail) {
                    results.push({
                        tool: testCase.tool,
                        caseFile: testCase.caseFile,
                        expected: "fail",
                        actual: `call failed as expected: ${message}`,
                        passed: true,
                    });
                }
                else {
                    const isSchemaError = Boolean(toolDef.outputSchema) &&
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
    }
    finally {
        try {
            await client.close();
        }
        catch {
            // ignore
        }
        try {
            await transport.close();
        }
        catch {
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
        report: formatReport(results),
    };
}
