/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */
export class SchemaFuzzer {
    /**
     * Checks whether the schema contains optional properties not listed in required.
     */
    static hasOptionalProperties(schema) {
        if (!schema || typeof schema !== "object" || !schema.properties) {
            return false;
        }
        const propKeys = Object.keys(schema.properties);
        const requiredKeys = new Set(Array.isArray(schema.required) ? schema.required : []);
        return propKeys.some((k) => !requiredKeys.has(k));
    }
    static resolveRef(ref, rootSchema) {
        if (!rootSchema || typeof rootSchema !== "object" || !ref.startsWith("#/")) {
            return undefined;
        }
        const parts = ref.slice(2).split("/");
        let curr = rootSchema;
        for (const part of parts) {
            if (curr && typeof curr === "object" && part in curr) {
                curr = curr[part];
            }
            else {
                return undefined;
            }
        }
        return curr && typeof curr === "object" ? curr : undefined;
    }
    /**
     * Generates a valid payload matching a given JSON Schema.
     *
     * @param schema The JSON Schema definition (typically tool.inputSchema).
     * @param propName Optional property name for contextual dummy values.
     * @param options Fuzzing options such as requiredOnly.
     * @param rootSchema The root tool schema for resolving $ref pointers.
     */
    static generateValidPayload(schema, propName = "param", options, rootSchema) {
        if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
            return {};
        }
        const effectiveRoot = rootSchema || schema;
        // Resolve $ref if present
        if ("$ref" in schema && typeof schema.$ref === "string") {
            const resolved = this.resolveRef(schema.$ref, effectiveRoot);
            if (resolved) {
                return this.generateValidPayload(resolved, propName, options, effectiveRoot);
            }
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
            return this.generateValidPayload(schema.oneOf[0], propName, options, effectiveRoot);
        }
        if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
            return this.generateValidPayload(schema.anyOf[0], propName, options, effectiveRoot);
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
            }
            else if (schema.items) {
                rawType = "array";
            }
            else {
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
                return this.generateArray(schema, propName, options, effectiveRoot);
            case "object":
                return this.generateObject(schema, options, effectiveRoot);
            case "null":
                return null;
            default:
                return {};
        }
    }
    static generateString(schema, propName) {
        const format = typeof schema.format === "string" ? schema.format : "";
        let val;
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
            default: {
                const lower = propName.toLowerCase();
                if (lower.includes("email")) {
                    val = "user@example.com";
                }
                else if (lower.includes("url") || lower.includes("uri")) {
                    val = "https://example.com";
                }
                else if (lower.includes("path") || lower.includes("file") || lower.includes("directory") || lower.includes("dir")) {
                    val = "/tmp/test.xlsx";
                }
                else {
                    val = propName ? `test-${propName}` : "test-string";
                }
                break;
            }
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
    static generateNumber(schema) {
        let min;
        if (typeof schema.minimum === "number") {
            min = schema.minimum;
        }
        else if (typeof schema.exclusiveMinimum === "number") {
            min = schema.exclusiveMinimum + (schema.type === "integer" ? 1 : 0.001);
        }
        let max;
        if (typeof schema.maximum === "number") {
            max = schema.maximum;
        }
        else if (typeof schema.exclusiveMaximum === "number") {
            max = schema.exclusiveMaximum - (schema.type === "integer" ? 1 : 0.001);
        }
        let val;
        if (min !== undefined && max !== undefined) {
            val = min <= 0 && max >= 0 ? 0 : min;
        }
        else if (min !== undefined) {
            val = Math.max(min, 1);
        }
        else if (max !== undefined) {
            val = Math.min(max, 1);
        }
        else {
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
    static generateArray(schema, propName, options, rootSchema) {
        let itemsSchema = schema.items;
        if (itemsSchema && typeof itemsSchema === "object" && "$ref" in itemsSchema && typeof itemsSchema.$ref === "string") {
            const resolved = this.resolveRef(itemsSchema.$ref, rootSchema || schema);
            if (resolved) {
                itemsSchema = resolved;
            }
        }
        const minItems = typeof schema.minItems === "number" ? schema.minItems : 1;
        const count = Math.max(minItems, 1);
        const result = [];
        for (let i = 0; i < count; i++) {
            if (itemsSchema) {
                result.push(this.generateValidPayload(itemsSchema, `${propName}_item`, options, rootSchema || schema));
            }
            else {
                result.push("item");
            }
        }
        return result;
    }
    static generateObject(schema, options, rootSchema) {
        const result = {};
        const properties = (schema.properties || {});
        const required = Array.isArray(schema.required) ? schema.required : [];
        // First generate all required properties
        for (const key of required) {
            if (properties[key]) {
                result[key] = this.generateValidPayload(properties[key], key, options, rootSchema || schema);
            }
            else {
                result[key] = "test-value";
            }
        }
        // Populate optional properties unless requiredOnly is requested
        if (!options?.requiredOnly) {
            for (const [key, propSchema] of Object.entries(properties)) {
                if (!(key in result)) {
                    result[key] = this.generateValidPayload(propSchema, key, options, rootSchema || schema);
                }
            }
        }
        return result;
    }
    /**
     * Generates boundary value payloads (e.g. minimum, maximum, empty string, minItems)
     */
    static generateBoundaryPayloads(schema) {
        if (!schema || typeof schema !== "object" || !schema.properties) {
            return [];
        }
        const properties = (schema.properties || {});
        const baseValid = (this.generateValidPayload(schema) || {});
        const boundaries = [];
        for (const [key, propSchema] of Object.entries(properties)) {
            if (!propSchema || typeof propSchema !== "object")
                continue;
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
            }
            else if (rawType === "string") {
                const isEnum = Array.isArray(propSchema.enum) && propSchema.enum.length > 0;
                const minLen = typeof propSchema.minLength === "number" ? propSchema.minLength : 0;
                if (minLen === 0) {
                    if (!isEnum || propSchema.enum.includes("")) {
                        boundaries.push({
                            payload: { ...baseValid, [key]: "" },
                            label: `boundary: ${key} = empty string`,
                        });
                    }
                }
                else if (!isEnum) {
                    boundaries.push({
                        payload: { ...baseValid, [key]: "a".repeat(minLen) },
                        label: `boundary: ${key} = minLength (${minLen})`,
                    });
                }
                if (!isEnum && typeof propSchema.maxLength === "number" && propSchema.maxLength < 1000) {
                    boundaries.push({
                        payload: { ...baseValid, [key]: "a".repeat(propSchema.maxLength) },
                        label: `boundary: ${key} = maxLength (${propSchema.maxLength})`,
                    });
                }
            }
            else if (rawType === "array") {
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
    static generateInvalidPayloads(schema) {
        if (!schema || typeof schema !== "object" || !schema.properties) {
            return [];
        }
        const properties = (schema.properties || {});
        const required = Array.isArray(schema.required) ? schema.required : [];
        const baseValid = (this.generateValidPayload(schema) || {});
        const invalidCases = [];
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
            if (!propSchema || typeof propSchema !== "object")
                continue;
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
            }
            else if (rawType === "string") {
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
            }
            else if (rawType === "boolean") {
                invalidCases.push({
                    payload: { ...baseValid, [key]: "not-a-boolean" },
                    reason: `invalid type for '${key}' (string instead of boolean)`,
                });
            }
            else if (rawType === "array") {
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
