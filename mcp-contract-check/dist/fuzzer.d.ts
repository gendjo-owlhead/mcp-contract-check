/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */
export interface FuzzPayloadOptions {
    requiredOnly?: boolean;
}
export declare class SchemaFuzzer {
    /**
     * Checks whether the schema contains optional properties not listed in required.
     */
    static hasOptionalProperties(schema?: Record<string, unknown> | null): boolean;
    /**
     * Generates a valid payload matching a given JSON Schema.
     *
     * @param schema The JSON Schema definition (typically tool.inputSchema).
     * @param propName Optional property name for contextual dummy values.
     * @param options Fuzzing options such as requiredOnly.
     */
    static generateValidPayload(schema?: Record<string, unknown> | null, propName?: string, options?: FuzzPayloadOptions): unknown;
    private static generateString;
    private static generateNumber;
    private static generateArray;
    private static generateObject;
}
