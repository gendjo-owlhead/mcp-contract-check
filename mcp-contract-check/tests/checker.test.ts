import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runContractCheck } from "../src/checker.js";
import { parseCommandLine } from "../src/command-parser.js";
import { buildCasesForTools, loadFixtures } from "../src/fixtures.js";
import { validateJsonSchema } from "../src/validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testCasesDir = path.join(__dirname, "test-cases");
const serverScript = path.join(__dirname, "fixtures", "test-server.js");

beforeAll(() => {
  if (!fs.existsSync(testCasesDir)) {
    fs.mkdirSync(testCasesDir, { recursive: true });
  }

  // Valid case
  fs.writeFileSync(
    path.join(testCasesDir, "greet-valid.json"),
    JSON.stringify({
      tool: "greet",
      arguments: { name: "Alice" },
      expected: "success",
    })
  );

  // Expected fail case
  fs.writeFileSync(
    path.join(testCasesDir, "fail-expected.json"),
    JSON.stringify({
      tool: "failTool",
      arguments: {},
      expected: "fail",
    })
  );
});

afterAll(() => {
  if (fs.existsSync(testCasesDir)) {
    fs.rmSync(testCasesDir, { recursive: true, force: true });
  }
});

describe("command-parser", () => {
  it("splits simple command and arguments", () => {
    const res = parseCommandLine("node server.js --broken");
    expect(res).toEqual({
      command: "node",
      args: ["server.js", "--broken"],
    });
  });

  it("handles double and single quoted strings", () => {
    const res = parseCommandLine('node "my server.js" --arg \'value with spaces\'');
    expect(res).toEqual({
      command: "node",
      args: ["my server.js", "--arg", "value with spaces"],
    });
  });

  it("throws on empty command string", () => {
    expect(() => parseCommandLine("   ")).toThrow("Command string cannot be empty");
  });

  it("handles flag arguments with quoted values without splitting", () => {
    const res = parseCommandLine('node server.js --config="path with spaces/config.json"');
    expect(res).toEqual({
      command: "node",
      args: ["server.js", '--config="path with spaces/config.json"'.replace(/^--config="(.+)"$/, "--config=$1")],
    });
    expect(res.args[1]).toBe("--config=path with spaces/config.json");
  });

  it("handles escaped quotes properly", () => {
    const res = parseCommandLine('echo "hello \\"world\\""');
    expect(res).toEqual({
      command: "echo",
      args: ['hello "world"'],
    });
  });

  it("throws on unclosed quote", () => {
    expect(() => parseCommandLine('node "unclosed string')).toThrow(
      "Unclosed quote in command string"
    );
  });
});

describe("validator", () => {
  it("validates data correctly against JSON schema", () => {
    const schema = {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    };

    expect(validateJsonSchema(schema, { text: "hi" }).valid).toBe(true);
    expect(validateJsonSchema(schema, { message: "hi" }).valid).toBe(false);
  });
});

describe("fixtures loader", () => {
  it("loads fixtures and adds default case for tools without fixtures", () => {
    const loaded = loadFixtures(testCasesDir);
    expect(loaded.length).toBeGreaterThanOrEqual(2);

    const tools = [
      { name: "greet" },
      { name: "failTool" },
      { name: "noFixtureTool" },
    ];
    const cases = buildCasesForTools(tools, loaded);
    const defaultCase = cases.find((c) => c.tool === "noFixtureTool");
    expect(defaultCase).toBeDefined();
    expect(defaultCase?.caseFile).toBe("(default)");
    expect(defaultCase?.arguments).toEqual({});
  });
});

describe("runContractCheck", () => {
  it("passes when all tools return valid output", async () => {
    const result = await runContractCheck({
      command: `node "${serverScript}" valid`,
      casesDir: testCasesDir,
    });

    expect(result.success).toBe(true);
    expect(result.failedCases).toBe(0);
    expect(result.report).toBe("ok");
  });

  it("fails when tool output does not match schema", async () => {
    const result = await runContractCheck({
      command: `node "${serverScript}" broken`,
      casesDir: testCasesDir,
    });

    expect(result.success).toBe(false);
    expect(result.failedCases).toBeGreaterThan(0);
    expect(result.report).toContain("Tool: greet");
    expect(result.report).toContain("Expected:");
    expect(result.report).toContain("Actual:");
  });

  it("rejects fixture with invalid arguments before calling tool", async () => {
    const invalidCaseFile = path.join(testCasesDir, "greet-invalid-arg.json");
    fs.writeFileSync(
      invalidCaseFile,
      JSON.stringify({
        tool: "greet",
        arguments: { name: 12345 }, // invalid: expects string
        expected: "success",
      })
    );

    try {
      const result = await runContractCheck({
        command: `node "${serverScript}" valid`,
        casesDir: testCasesDir,
      });

      expect(result.success).toBe(false);
      const invalidCase = result.results.find(
        (r) => r.caseFile.includes("greet-invalid-arg")
      );
      expect(invalidCase).toBeDefined();
      expect(invalidCase?.passed).toBe(false);
      expect(invalidCase?.actual).toContain("fixture error: arguments do not match input schema");
    } finally {
      if (fs.existsSync(invalidCaseFile)) {
        fs.unlinkSync(invalidCaseFile);
      }
    }
  });

  it("handles expected failure correctly", async () => {
    // When failTool returns isError: true and fixture expects "fail", it should pass!
    const result = await runContractCheck({
      command: `node "${serverScript}" valid`,
      casesDir: testCasesDir,
    });

    const failCase = result.results.find((r) => r.tool === "failTool");
    expect(failCase?.passed).toBe(true);
  });

  it("synthesizes valid inputs with fuzz option when fixtures are missing", async () => {
    const emptyDir = path.join(__dirname, "empty-cases-test");
    if (!fs.existsSync(emptyDir)) {
      fs.mkdirSync(emptyDir, { recursive: true });
    }

    try {
      const noFuzzRes = await runContractCheck({
        command: `node "${serverScript}" valid`,
        casesDir: emptyDir,
        fuzz: false,
      });
      const greetNoFuzz = noFuzzRes.results.find((r) => r.tool === "greet");
      expect(greetNoFuzz?.passed).toBe(false);
      expect(greetNoFuzz?.actual).toContain("fixture error: arguments do not match input schema");

      const fuzzRes = await runContractCheck({
        command: `node "${serverScript}" valid`,
        casesDir: emptyDir,
        fuzz: true,
      });
      const greetFuzzed = fuzzRes.results.find((r) => r.tool === "greet");
      expect(greetFuzzed?.passed).toBe(true);
      expect(greetFuzzed?.caseFile).toBe("(fuzzed)");
    } finally {
      if (fs.existsSync(emptyDir)) {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    }
  });
});
