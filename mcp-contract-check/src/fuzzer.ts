/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */

export interface FuzzPayloadOptions {
  requiredOnly?: boolean;
}

export class SchemaFuzzer {
  /**
   * Checks whether the schema contains optional properties not listed in required.
   */
  public static hasOptionalProperties(schema?: Record<string, unknown> | null): boolean {
    if (!schema || typeof schema !== "object" || !schema.properties) {
      return false;
    }
    const propKeys = Object.keys(schema.properties as object);
    const requiredKeys = new Set(
      Array.isArray(schema.required) ? (schema.required as string[]) : []
    );
    return propKeys.some((k) => !requiredKeys.has(k));
  }

  /**
   * Generates a valid payload matching a given JSON Schema.
   *
   * @param schema The JSON Schema definition (typically tool.inputSchema).
   * @param propName Optional property name for contextual dummy values.
   * @param options Fuzzing options such as requiredOnly.
   */
  public static generateValidPayload(
    schema?: Record<string, unknown> | null,
    propName = "param",
    options?: FuzzPayloadOptions
  ): unknown {
    if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
      return {};
    }

    // Explicit constant
    if ("const" in schema) {
      return schema.const;
    }

    // Enum values: pick first candidate
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0];
    }

    // Default value
    if ("default" in schema && schema.default !== undefined) {
      return schema.default;
    }

    // anyOf / oneOf: use the first variant
    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      return this.generateValidPayload(schema.oneOf[0] as Record<string, unknown>, propName, options);
    }
    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      return this.generateValidPayload(schema.anyOf[0] as Record<string, unknown>, propName, options);
    }

    // If type is an array of types, take the first non-null type
    let rawType = schema.type;
    if (Array.isArray(rawType)) {
      rawType = rawType.find((t) => t !== "null") || rawType[0];
    }

    // If no type specified, infer from properties or items
    if (!rawType) {
      if (schema.properties) {
        rawType = "object";
      } else if (schema.items) {
        rawType = "array";
      } else {
        rawType = "string";
      }
    }

    switch (rawType) {
      case "string":
        return this.generateString(schema, propName);

      case "integer":
      case "number":
        return this.generateNumber(schema);

      case "boolean":
        return true;

      case "array":
        return this.generateArray(schema, propName, options);

      case "object":
        return this.generateObject(schema, options);

      case "null":
        return null;

      default:
        return {};
    }
  }

  private static generateString(
    schema: Record<string, unknown>,
    propName: string
  ): string {
    const format = typeof schema.format === "string" ? schema.format : "";

    let val: string;
    switch (format) {
      case "email":
        val = "user@example.com";
        break;
      case "uri":
      case "url":
        val = "https://example.com";
        break;
      case "date-time":
        val = new Date().toISOString();
        break;
      case "date":
        val = "2026-01-01";
        break;
      case "uuid":
        val = "123e4567-e89b-12d3-a456-426614174000";
        break;
      case "ipv4":
        val = "127.0.0.1";
        break;
      default:
        val = propName ? `test-${propName}` : "test-string";
        break;
    }

    const minLength = typeof schema.minLength === "number" ? schema.minLength : 0;
    const maxLength = typeof schema.maxLength === "number" ? schema.maxLength : Infinity;

    while (val.length < minLength) {
      val += "_pad";
    }

    if (val.length > maxLength) {
      val = val.slice(0, maxLength);
    }

    return val;
  }

  private static generateNumber(schema: Record<string, unknown>): number {
    let min: number | undefined;
    if (typeof schema.minimum === "number") {
      min = schema.minimum;
    } else if (typeof schema.exclusiveMinimum === "number") {
      min = schema.exclusiveMinimum + (schema.type === "integer" ? 1 : 0.001);
    }

    let max: number | undefined;
    if (typeof schema.maximum === "number") {
      max = schema.maximum;
    } else if (typeof schema.exclusiveMaximum === "number") {
      max = schema.exclusiveMaximum - (schema.type === "integer" ? 1 : 0.001);
    }

    let val: number;
    if (min !== undefined && max !== undefined) {
      val = min <= 0 && max >= 0 ? 0 : min;
    } else if (min !== undefined) {
      val = Math.max(min, 1);
    } else if (max !== undefined) {
      val = Math.min(max, 1);
    } else {
      val = 1;
    }

    if (typeof schema.multipleOf === "number" && schema.multipleOf > 0) {
      const step = schema.multipleOf;
      val = Math.ceil(val / step) * step;
      if (max !== undefined && val > max) {
        val = Math.floor(max / step) * step;
      }
    }

    return schema.type === "integer" ? Math.round(val) : val;
  }

  private static generateArray(
    schema: Record<string, unknown>,
    propName: string,
    options?: FuzzPayloadOptions
  ): unknown[] {
    const itemsSchema = schema.items as Record<string, unknown> | undefined;
    const minItems = typeof schema.minItems === "number" ? schema.minItems : 1;

    const count = Math.max(minItems, 1);
    const result: unknown[] = [];

    for (let i = 0; i < count; i++) {
      if (itemsSchema) {
        result.push(this.generateValidPayload(itemsSchema, `${propName}_item`, options));
      } else {
        result.push("item");
      }
    }

    return result;
  }

  private static generateObject(
    schema: Record<string, unknown>,
    options?: FuzzPayloadOptions
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];

    // First generate all required properties
    for (const key of required) {
      if (properties[key]) {
        result[key] = this.generateValidPayload(properties[key], key, options);
      } else {
        result[key] = "test-value";
      }
    }

    // Populate optional properties unless requiredOnly is requested
    if (!options?.requiredOnly) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (!(key in result)) {
          result[key] = this.generateValidPayload(propSchema, key, options);
        }
      }
    }

    return result;
  }

  /**
   * Generates boundary value payloads (e.g. minimum, maximum, empty string, minItems)
   */
  public static generateBoundaryPayloads(
    schema?: Record<string, unknown> | null
  ): Array<{ payload: Record<string, unknown>; label: string }> {
    if (!schema || typeof schema !== "object" || !schema.properties) {
      return [];
    }

    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const baseValid = (this.generateValidPayload(schema) || {}) as Record<string, unknown>;
    const boundaries: Array<{ payload: Record<string, unknown>; label: string }> = [];

    for (const [key, propSchema] of Object.entries(properties)) {
      if (!propSchema || typeof propSchema !== "object") continue;

      const rawType = propSchema.type;
      if (rawType === "integer" || rawType === "number") {
        if (typeof propSchema.minimum === "number") {
          boundaries.push({
            payload: { ...baseValid, [key]: propSchema.minimum },
            label: `boundary: ${key} = minimum (${propSchema.minimum})`,
          });
        }
        if (typeof propSchema.maximum === "number") {
          boundaries.push({
            payload: { ...baseValid, [key]: propSchema.maximum },
            label: `boundary: ${key} = maximum (${propSchema.maximum})`,
          });
        }
        if (typeof propSchema.exclusiveMinimum === "number") {
          const val = propSchema.exclusiveMinimum + (rawType === "integer" ? 1 : 0.001);
          boundaries.push({
            payload: { ...baseValid, [key]: val },
            label: `boundary: ${key} = exclusiveMinimum + 1 (${val})`,
          });
        }
        if (typeof propSchema.exclusiveMaximum === "number") {
          const val = propSchema.exclusiveMaximum - (rawType === "integer" ? 1 : 0.001);
          boundaries.push({
            payload: { ...baseValid, [key]: val },
            label: `boundary: ${key} = exclusiveMaximum - 1 (${val})`,
          });
        }
      } else if (rawType === "string") {
        const minLen = typeof propSchema.minLength === "number" ? propSchema.minLength : 0;
        if (minLen === 0) {
          boundaries.push({
            payload: { ...baseValid, [key]: "" },
            label: `boundary: ${key} = empty string`,
          });
        } else {
          boundaries.push({
            payload: { ...baseValid, [key]: "a".repeat(minLen) },
            label: `boundary: ${key} = minLength (${minLen})`,
          });
        }
        if (typeof propSchema.maxLength === "number" && propSchema.maxLength < 1000) {
          boundaries.push({
            payload: { ...baseValid, [key]: "a".repeat(propSchema.maxLength) },
            label: `boundary: ${key} = maxLength (${propSchema.maxLength})`,
          });
        }
      } else if (rawType === "array") {
        const minItems = typeof propSchema.minItems === "number" ? propSchema.minItems : 0;
        if (minItems === 0) {
          boundaries.push({
            payload: { ...baseValid, [key]: [] },
            label: `boundary: ${key} = empty array`,
          });
        }
      }
    }

    return boundaries;
  }

  /**
   * Generates invalid payloads violating schema constraints for negative testing.
   */
  public static generateInvalidPayloads(
    schema?: Record<string, unknown> | null
  ): Array<{ payload: Record<string, unknown>; reason: string }> {
    if (!schema || typeof schema !== "object" || !schema.properties) {
      return [];
    }

    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    const baseValid = (this.generateValidPayload(schema) || {}) as Record<string, unknown>;
    const invalidCases: Array<{ payload: Record<string, unknown>; reason: string }> = [];

    // 1. Missing required properties
    for (const reqKey of required) {
      const copy = { ...baseValid };
      delete copy[reqKey];
      invalidCases.push({
        payload: copy,
        reason: `missing required property '${reqKey}'`,
      });
    }

    // 2. Type violations & constraint breaches
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!propSchema || typeof propSchema !== "object") continue;

      const rawType = propSchema.type;
      if (rawType === "integer" || rawType === "number") {
        invalidCases.push({
          payload: { ...baseValid, [key]: "invalid_string_instead_of_number" },
          reason: `invalid type for '${key}' (string instead of number)`,
        });

        if (typeof propSchema.minimum === "number") {
          invalidCases.push({
            payload: { ...baseValid, [key]: propSchema.minimum - 1 },
            reason: `'${key}' below minimum (${propSchema.minimum - 1} < ${propSchema.minimum})`,
          });
        }

        if (typeof propSchema.maximum === "number") {
          invalidCases.push({
            payload: { ...baseValid, [key]: propSchema.maximum + 1 },
            reason: `'${key}' above maximum (${propSchema.maximum + 1} > ${propSchema.maximum})`,
          });
        }
      } else if (rawType === "string") {
        invalidCases.push({
          payload: { ...baseValid, [key]: 12345 },
          reason: `invalid type for '${key}' (number instead of string)`,
        });

        if (typeof propSchema.minLength === "number" && propSchema.minLength > 0) {
          invalidCases.push({
            payload: { ...baseValid, [key]: "" },
            reason: `'${key}' string length 0 violates minLength ${propSchema.minLength}`,
          });
        }
      } else if (rawType === "boolean") {
        invalidCases.push({
          payload: { ...baseValid, [key]: "not-a-boolean" },
          reason: `invalid type for '${key}' (string instead of boolean)`,
        });
      } else if (rawType === "array") {
        invalidCases.push({
          payload: { ...baseValid, [key]: "not-an-array" },
          reason: `invalid type for '${key}' (string instead of array)`,
        });
      }

      if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
        invalidCases.push({
          payload: { ...baseValid, [key]: "__INVALID_ENUM_VALUE__" },
          reason: `'${key}' has invalid enum value '__INVALID_ENUM_VALUE__'`,
        });
      }
    }

    return invalidCases;
  }
}
