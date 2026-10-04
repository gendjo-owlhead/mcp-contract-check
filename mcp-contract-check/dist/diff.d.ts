/**
 * ContractDiff
 * Detects breaking changes and schema drift between MCP tool contracts.
 */
export interface ToolContract {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
}
export interface ContractSnapshot {
    version: string;
    generatedAt: string;
    tools: ToolContract[];
}
export type DriftSeverity = "breaking" | "non-breaking";
export type DriftType = "tool_removed" | "tool_added" | "description_changed" | "input_required_added" | "input_enum_removed" | "input_type_narrowed" | "input_type_widened" | "output_property_removed" | "output_required_added";
export interface DriftIssue {
    tool: string;
    type: DriftType;
    severity: DriftSeverity;
    message: string;
    path?: string;
}
export interface DiffResult {
    compatible: boolean;
    breakingCount: number;
    nonBreakingCount: number;
    issues: DriftIssue[];
}
export declare class ContractDiff {
    static createSnapshot(tools: ToolContract[]): ContractSnapshot;
    static compare(baseline: ContractSnapshot, currentTools: ToolContract[]): DiffResult;
    private static compareInputSchemas;
    private static normalizeTypes;
    private static compareOutputSchemas;
    static formatReport(diff: DiffResult): string;
}
