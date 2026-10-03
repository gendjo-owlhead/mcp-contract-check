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
});
