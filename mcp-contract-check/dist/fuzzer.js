/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */
export class SchemaFuzzer {
    /**
     * Generates a valid payload matching a given JSON Schema.
     *
     * @param schema The JSON Schema definition (typically tool.inputSchema).
     * @param propName Optional property name for contextual dummy values.
     */
    static generateValidPayload(schema, propName = "param") {
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
            return this.generateValidPayload(schema.oneOf[0], propName);
        }
        if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
            return this.generateValidPayload(schema.anyOf[0], propName);
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
                return this.generateArray(schema, propName);
            case "object":
                return this.generateObject(schema);
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
    static generateArray(schema, propName) {
        const itemsSchema = schema.items;
        const minItems = typeof schema.minItems === "number" ? schema.minItems : 1;
        const count = Math.max(minItems, 1);
        const result = [];
        for (let i = 0; i < count; i++) {
            if (itemsSchema) {
                result.push(this.generateValidPayload(itemsSchema, `${propName}_item`));
            }
            else {
                result.push("item");
            }
        }
        return result;
    }
    static generateObject(schema) {
        const result = {};
        const properties = (schema.properties || {});
        const required = Array.isArray(schema.required) ? schema.required : [];
        // First generate all required properties
        for (const key of required) {
            if (properties[key]) {
                result[key] = this.generateValidPayload(properties[key], key);
            }
            else {
                result[key] = "test-value";
            }
        }
        // Also populate optional properties so the tool gets comprehensive inputs
        for (const [key, propSchema] of Object.entries(properties)) {
            if (!(key in result)) {
                result[key] = this.generateValidPayload(propSchema, key);
            }
        }
        return result;
    }
}
