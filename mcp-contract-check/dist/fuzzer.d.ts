/**
 * SchemaFuzzer
 * Automatically synthesizes valid argument payloads from JSON Schema definitions.
 */
export declare class SchemaFuzzer {
    /**
     * Generates a valid payload matching a given JSON Schema.
     *
     * @param schema The JSON Schema definition (typically tool.inputSchema).
     * @param propName Optional property name for contextual dummy values.
     */
    static generateValidPayload(schema?: Record<string, unknown> | null, propName?: string): unknown;
    private static generateString;
    private static generateNumber;
    private static generateArray;
    private static generateObject;
}
