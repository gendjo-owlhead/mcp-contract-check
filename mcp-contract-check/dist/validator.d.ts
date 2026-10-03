export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateJsonSchema(schema: unknown, data: unknown): ValidationResult;
