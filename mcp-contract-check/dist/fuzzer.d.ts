/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */
export interface FuzzPayloadOptions {
    requiredOnly?: boolean;
}
export declare class SchemaFuzzer {
    private static readonly MAX_RECURSION_DEPTH;
    /**
     * Checks whether the schema contains optional properties not listed in required.
     */
    static hasOptionalProperties(schema?: Record<string, unknown> | null): boolean;
    private static resolveRef;
    /**
     * Generates a valid payload matching a given JSON Schema.
     *
     * @param schema The JSON Schema definition (typically tool.inputSchema).
     * @param propName Optional property name for contextual dummy values.
     * @param options Fuzzing options such as requiredOnly.
     * @param rootSchema The root tool schema for resolving $ref pointers.
     */
    static generateValidPayload(schema?: Record<string, unknown> | null, propName?: string, options?: FuzzPayloadOptions, rootSchema?: Record<string, unknown>, recursionDepth?: number): unknown;
    private static generateString;
    private static generateNumber;
    private static generateArray;
    private static generateObject;
    /**
     * Generates boundary value payloads (e.g. minimum, maximum, empty string, minItems)
     */
    static generateBoundaryPayloads(schema?: Record<string, unknown> | null): Array<{
        payload: Record<string, unknown>;
        label: string;
    }>;
    /**
     * Generates invalid payloads violating schema constraints for negative testing.
     */
    static generateInvalidPayloads(schema?: Record<string, unknown> | null): Array<{
        payload: Record<string, unknown>;
        reason: string;
    }>;
}
