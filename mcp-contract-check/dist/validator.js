import AjvPkg from "ajv";
import addFormatsPkg from "ajv-formats";
const Ajv = AjvPkg.default || AjvPkg;
const addFormats = addFormatsPkg.default ||
    addFormatsPkg;
const ajv = new Ajv({
    allErrors: true,
    strict: false,
});
addFormats(ajv);
export function validateJsonSchema(schema, data) {
    if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
        return { valid: true, errors: [] };
    }
    try {
        const validate = ajv.compile(schema);
        const valid = validate(data);
        if (!valid) {
            const errors = (validate.errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message}`.trim());
            return { valid: false, errors };
        }
        return { valid: true, errors: [] };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, errors: [message] };
    }
}
