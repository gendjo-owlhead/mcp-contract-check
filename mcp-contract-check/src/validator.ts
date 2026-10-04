import AjvPkg from "ajv";
import addFormatsPkg from "ajv-formats";

const Ajv = (AjvPkg as unknown as { default: typeof AjvPkg }).default || AjvPkg;
const addFormats =
  (addFormatsPkg as unknown as { default: typeof addFormatsPkg }).default ||
  addFormatsPkg;

const ajv = new (Ajv as any)({
  allErrors: true,
  strict: false,
  addUsedSchema: false,
});
(addFormats as any)(ajv);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateJsonSchema(schema: unknown, data: unknown): ValidationResult {
  if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
    return { valid: true, errors: [] };
  }

  try {
    const valid = ajv.validate(schema as Record<string, unknown>, data);
    if (!valid) {
      const errors = (ajv.errors ?? []).map(
        (err: { instancePath?: string; message?: string }) =>
          `${err.instancePath || "/"} ${err.message}`.trim()
      );
      ajv.removeSchema(); // Clear compiled schemas to prevent memory leaks
      return { valid: false, errors };
    }
    ajv.removeSchema(); // Clear compiled schemas to prevent memory leaks
    return { valid: true, errors: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
