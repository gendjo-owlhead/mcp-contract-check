import AjvPkg from "ajv";
import addFormatsPkg from "ajv-formats";
const Ajv = AjvPkg.default || AjvPkg;
const addFormats = addFormatsPkg.default ||
    addFormatsPkg;
const ajv = new Ajv({
    allErrors: true,
    strict: false,
    addUsedSchema: false,
});
addFormats(ajv);
export function validateJsonSchema(schema, data) {
    if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
        return { valid: true, errors: [] };
    }
    try {
        const valid = ajv.validate(schema, data);
        if (!valid) {
            const errors = (ajv.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message}`.trim());
            ajv.removeSchema(); // Clear compiled schemas to prevent memory leaks
            return { valid: false, errors };
        }
        ajv.removeSchema(); // Clear compiled schemas to prevent memory leaks
        return { valid: true, errors: [] };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, errors: [message] };
    }
}
