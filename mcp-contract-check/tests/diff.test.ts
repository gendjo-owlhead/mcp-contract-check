import { describe, expect, it } from "vitest";
import { ContractDiff, ToolContract } from "../src/diff.js";

describe("ContractDiff", () => {
  const baseTools: ToolContract[] = [
    {
      name: "getUser",
      description: "Gets a user by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          format: { type: "string", enum: ["json", "xml"] },
        },
        required: ["id"],
      },
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  ];

  it("reports compatible when contracts match exactly", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const result = ContractDiff.compare(snapshot, baseTools);

    expect(result.compatible).toBe(true);
    expect(result.breakingCount).toBe(0);
    expect(result.issues.length).toBe(0);
  });

  it("detects removed tool as breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const result = ContractDiff.compare(snapshot, []); // tool removed

    expect(result.compatible).toBe(false);
    expect(result.breakingCount).toBe(1);
    expect(result.issues[0].type).toBe("tool_removed");
    expect(result.issues[0].severity).toBe("breaking");
  });

  it("detects added tool as non-breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const extendedTools = [
      ...baseTools,
      {
        name: "listUsers",
        inputSchema: { type: "object" },
      },
    ];
    const result = ContractDiff.compare(snapshot, extendedTools);

    expect(result.compatible).toBe(true);
    expect(result.breakingCount).toBe(0);
    expect(result.nonBreakingCount).toBe(1);
    expect(result.issues[0].type).toBe("tool_added");
    expect(result.issues[0].severity).toBe("non-breaking");
  });

  it("detects new required input property as breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const modifiedTools: ToolContract[] = [
      {
        name: "getUser",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            apiKey: { type: "string" },
          },
          required: ["id", "apiKey"], // apiKey newly required!
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, modifiedTools);
    expect(result.compatible).toBe(false);
    expect(result.breakingCount).toBe(1);
    expect(result.issues[0].type).toBe("input_required_added");
    expect(result.issues[0].path).toBe("arguments.apiKey");
  });

  it("detects removed enum value from input as breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const modifiedTools: ToolContract[] = [
      {
        name: "getUser",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            format: { type: "string", enum: ["json"] }, // "xml" removed!
          },
          required: ["id"],
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, modifiedTools);
    expect(result.compatible).toBe(false);
    expect(result.breakingCount).toBe(1);
    expect(result.issues[0].type).toBe("input_enum_removed");
    expect(result.issues[0].message).toContain("xml");
  });

  it("detects removed output property as breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const modifiedTools: ToolContract[] = [
      {
        name: "getUser",
        inputSchema: baseTools[0].inputSchema,
        outputSchema: {
          type: "object",
          properties: {
            id: { type: "string" }, // 'name' was removed!
          },
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, modifiedTools);
    expect(result.compatible).toBe(false);
    expect(result.breakingCount).toBe(1);
    expect(result.issues[0].type).toBe("output_property_removed");
    expect(result.issues[0].path).toBe("output.name");
  });

  it("handles multi-type array schemas without false positive breaking changes", () => {
    const multiTypeTools: ToolContract[] = [
      {
        name: "queryData",
        inputSchema: {
          type: "object",
          properties: {
            filter: { type: ["string", "null"] },
          },
        },
      },
    ];

    const snapshot = ContractDiff.createSnapshot(multiTypeTools);
    // Compare with equivalent newly constructed tools having identical types
    const sameTools: ToolContract[] = [
      {
        name: "queryData",
        inputSchema: {
          type: "object",
          properties: {
            filter: { type: ["string", "null"] },
          },
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, sameTools);
    expect(result.compatible).toBe(true);
    expect(result.breakingCount).toBe(0);
    expect(result.issues.length).toBe(0);
  });

  it("detects type widening as non-breaking change", () => {
    const stringTool: ToolContract[] = [
      {
        name: "fetchItem",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    ];

    const snapshot = ContractDiff.createSnapshot(stringTool);
    // Widened to accept string or number
    const widenedTool: ToolContract[] = [
      {
        name: "fetchItem",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: ["string", "number"] },
          },
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, widenedTool);
    expect(result.compatible).toBe(true);
    expect(result.breakingCount).toBe(0);
    expect(result.nonBreakingCount).toBe(1);
    expect(result.issues[0].type).toBe("input_type_widened");
  });

  it("detects type narrowing as breaking change", () => {
    const unionTool: ToolContract[] = [
      {
        name: "fetchItem",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: ["string", "number"] },
          },
        },
      },
    ];

    const snapshot = ContractDiff.createSnapshot(unionTool);
    // Narrowed to only accept string
    const narrowedTool: ToolContract[] = [
      {
        name: "fetchItem",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    ];

    const result = ContractDiff.compare(snapshot, narrowedTool);
    expect(result.compatible).toBe(false);
    expect(result.breakingCount).toBe(1);
    expect(result.issues[0].type).toBe("input_type_narrowed");
  });

  it("formats readable breaking change reports", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const result = ContractDiff.compare(snapshot, []);
    const report = ContractDiff.formatReport(result);

    expect(report).toContain("CONTRACT BREAKING CHANGES (1):");
    expect(report).toContain("[BREAKING] getUser");
  });

  it("detects tool description drift as non-breaking change", () => {
    const snapshot = ContractDiff.createSnapshot(baseTools);
    const modifiedTools = [
      {
        ...baseTools[0],
        description: "Retrieves a user account and profile by identifier",
      },
    ];
    const result = ContractDiff.compare(snapshot, modifiedTools);

    expect(result.compatible).toBe(true);
    expect(result.breakingCount).toBe(0);
    expect(result.nonBreakingCount).toBe(1);
    expect(result.issues[0].type).toBe("description_changed");
    expect(result.issues[0].severity).toBe("non-breaking");
    expect(result.issues[0].message).toContain("description changed");
  });
});
