import AjvPkg from "ajv";
import addFormatsPkg from "ajv-formats";

const Ajv = (AjvPkg as unknown as { default: typeof AjvPkg }).default || AjvPkg;
const addFormats =
  (addFormatsPkg as unknown as { default: typeof addFormatsPkg }).default ||
  addFormatsPkg;

const ajv = new (Ajv as any)({
  allErrors: true,
  strict: false,
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
    const validate = ajv.compile(schema as Record<string, unknown>);
    const valid = validate(data);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (err: { instancePath?: string; message?: string }) =>
          `${err.instancePath || "/"} ${err.message}`.trim()
      );
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
