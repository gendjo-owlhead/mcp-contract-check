import { describe, expect, it } from "vitest";
import { SchemaFuzzer } from "../src/fuzzer.js";
import { validateJsonSchema } from "../src/validator.js";

describe("SchemaFuzzer", () => {
  it("handles null and empty schemas", () => {
    expect(SchemaFuzzer.generateValidPayload(null)).toEqual({});
    expect(SchemaFuzzer.generateValidPayload({})).toEqual({});
  });

  it("synthesizes valid primitive types", () => {
    const stringSchema = { type: "string" };
    const str = SchemaFuzzer.generateValidPayload(stringSchema, "username");
    expect(typeof str).toBe("string");
    expect(validateJsonSchema(stringSchema, str).valid).toBe(true);

    const intSchema = { type: "integer", minimum: 10, maximum: 50 };
    const num = SchemaFuzzer.generateValidPayload(intSchema);
    expect(typeof num).toBe("number");
    expect(num).toBeGreaterThanOrEqual(10);
    expect(num).toBeLessThanOrEqual(50);
    expect(validateJsonSchema(intSchema, num).valid).toBe(true);

    const boolSchema = { type: "boolean" };
    const bool = SchemaFuzzer.generateValidPayload(boolSchema);
    expect(typeof bool).toBe("boolean");
    expect(validateJsonSchema(boolSchema, bool).valid).toBe(true);
  });

  it("respects enums and defaults", () => {
    const enumSchema = { type: "string", enum: ["alpha", "beta", "gamma"] };
    const enumVal = SchemaFuzzer.generateValidPayload(enumSchema);
    expect(enumVal).toBe("alpha");
    expect(validateJsonSchema(enumSchema, enumVal).valid).toBe(true);

    const defaultSchema = { type: "string", default: "custom-default" };
    expect(SchemaFuzzer.generateValidPayload(defaultSchema)).toBe("custom-default");
  });

  it("synthesizes formatted strings", () => {
    const emailSchema = { type: "string", format: "email" };
    const email = SchemaFuzzer.generateValidPayload(emailSchema);
    expect(email).toBe("user@example.com");
    expect(validateJsonSchema(emailSchema, email).valid).toBe(true);

    const uriSchema = { type: "string", format: "uri" };
    const uri = SchemaFuzzer.generateValidPayload(uriSchema);
    expect(uri).toBe("https://example.com");
    expect(validateJsonSchema(uriSchema, uri).valid).toBe(true);
  });

  it("synthesizes complex nested objects with required properties", () => {
    const complexSchema = {
      type: "object",
      properties: {
        userId: { type: "string" },
        count: { type: "integer", minimum: 5 },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        profile: {
          type: "object",
          properties: {
            bio: { type: "string" },
          },
          required: ["bio"],
        },
      },
      required: ["userId", "profile"],
    };

    const payload = SchemaFuzzer.generateValidPayload(complexSchema) as Record<string, unknown>;
    expect(payload).toHaveProperty("userId");
    expect(payload).toHaveProperty("profile");
    expect((payload.profile as Record<string, unknown>).bio).toBeDefined();

    const validation = validateJsonSchema(complexSchema, payload);
    expect(validation.valid).toBe(true);
  });

  it("handles negative ranges and multipleOf constraints", () => {
    const negSchema = { type: "number", minimum: -20, maximum: -5, multipleOf: 5 };
    const val = SchemaFuzzer.generateValidPayload(negSchema);
    expect(typeof val).toBe("number");
    expect(val).toBeGreaterThanOrEqual(-20);
    expect(val).toBeLessThanOrEqual(-5);
    expect(validateJsonSchema(negSchema, val).valid).toBe(true);
  });

  it("detects optional properties with hasOptionalProperties", () => {
    const schemaWithOpt = {
      type: "object",
      properties: {
        req: { type: "string" },
        opt: { type: "number" },
      },
      required: ["req"],
    };
    expect(SchemaFuzzer.hasOptionalProperties(schemaWithOpt)).toBe(true);

    const schemaOnlyReq = {
      type: "object",
      properties: {
        req: { type: "string" },
      },
      required: ["req"],
    };
    expect(SchemaFuzzer.hasOptionalProperties(schemaOnlyReq)).toBe(false);
  });

  it("generates minimal required-only payloads when requested", () => {
    const schema = {
      type: "object",
      properties: {
        mandatory: { type: "string" },
        optionalField: { type: "string" },
      },
      required: ["mandatory"],
    };

    const minimal = SchemaFuzzer.generateValidPayload(schema, "param", { requiredOnly: true }) as Record<string, unknown>;
    expect(minimal).toHaveProperty("mandatory");
    expect(minimal).not.toHaveProperty("optionalField");
    expect(validateJsonSchema(schema, minimal).valid).toBe(true);

    const full = SchemaFuzzer.generateValidPayload(schema, "param", { requiredOnly: false }) as Record<string, unknown>;
    expect(full).toHaveProperty("mandatory");
    expect(full).toHaveProperty("optionalField");
    expect(validateJsonSchema(schema, full).valid).toBe(true);
  });

  it("synthesizes boundary payloads for integer, string, and array constraints", () => {
    const schema = {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 100 },
        tag: { type: "string", minLength: 2, maxLength: 10 },
        items: { type: "array", minItems: 0 },
      },
      required: ["score", "tag"],
    };

    const boundaries = SchemaFuzzer.generateBoundaryPayloads(schema);
    expect(boundaries.length).toBeGreaterThan(0);

    const minScore = boundaries.find((b) => b.label.includes("minimum"));
    expect(minScore?.payload.score).toBe(0);

    const maxScore = boundaries.find((b) => b.label.includes("maximum"));
    expect(maxScore?.payload.score).toBe(100);

    const minTag = boundaries.find((b) => b.label.includes("minLength"));
    expect((minTag?.payload.tag as string).length).toBe(2);

    const maxTag = boundaries.find((b) => b.label.includes("maxLength"));
    expect((maxTag?.payload.tag as string).length).toBe(10);
  });

  it("synthesizes invalid payloads for negative testing", () => {
    const schema = {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 18, maximum: 65 },
        username: { type: "string", minLength: 3 },
      },
      required: ["username"],
    };

    const invalid = SchemaFuzzer.generateInvalidPayloads(schema);
    expect(invalid.length).toBeGreaterThan(0);

    // Missing required field
    const missingUsername = invalid.find((i) => i.reason.includes("missing required property 'username'"));
    expect(missingUsername).toBeDefined();
    expect(missingUsername?.payload).not.toHaveProperty("username");

    // Invalid type for age
    const badAge = invalid.find((i) => i.reason.includes("invalid type for 'age'"));
    expect(badAge?.payload.age).toBe("invalid_string_instead_of_number");

    // Out of bounds minimum
    const belowMin = invalid.find((i) => i.reason.includes("below minimum"));
    expect(belowMin?.payload.age).toBe(17);
  });
});
