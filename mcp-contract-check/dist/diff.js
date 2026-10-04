/**
 * ContractDiff
 * Detects breaking changes and schema drift between MCP tool contracts.
 */
export class ContractDiff {
    static createSnapshot(tools) {
        return {
            version: "1.0.0",
            generatedAt: new Date().toISOString(),
            tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema ? JSON.parse(JSON.stringify(t.inputSchema)) : undefined,
                outputSchema: t.outputSchema ? JSON.parse(JSON.stringify(t.outputSchema)) : undefined,
            })),
        };
    }
    static compare(baseline, currentTools) {
        const issues = [];
        const currentToolMap = new Map(currentTools.map((t) => [t.name, t]));
        const baselineToolMap = new Map(baseline.tools.map((t) => [t.name, t]));
        // 1. Check for removed tools (breaking)
        for (const [name] of baselineToolMap) {
            if (!currentToolMap.has(name)) {
                issues.push({
                    tool: name,
                    type: "tool_removed",
                    severity: "breaking",
                    message: `Tool '${name}' was removed from the server`,
                });
            }
        }
        // 2. Check for added tools (non-breaking)
        for (const [name] of currentToolMap) {
            if (!baselineToolMap.has(name)) {
                issues.push({
                    tool: name,
                    type: "tool_added",
                    severity: "non-breaking",
                    message: `New tool '${name}' was added to the server`,
                });
            }
        }
        // 3. For tools present in both, compare schemas and descriptions
        for (const [name, baselineTool] of baselineToolMap) {
            const currentTool = currentToolMap.get(name);
            if (!currentTool) {
                continue;
            }
            // Check description drift (non-breaking)
            if (baselineTool.description !== undefined &&
                currentTool.description !== undefined &&
                baselineTool.description !== currentTool.description) {
                issues.push({
                    tool: name,
                    type: "description_changed",
                    severity: "non-breaking",
                    message: `Tool '${name}' description changed (model instructions drifted)`,
                });
            }
            // Check input schema changes
            this.compareInputSchemas(name, baselineTool.inputSchema, currentTool.inputSchema, issues);
            // Check output schema changes
            this.compareOutputSchemas(name, baselineTool.outputSchema, currentTool.outputSchema, issues);
        }
        const breakingCount = issues.filter((i) => i.severity === "breaking").length;
        const nonBreakingCount = issues.length - breakingCount;
        return {
            compatible: breakingCount === 0,
            breakingCount,
            nonBreakingCount,
            issues,
        };
    }
    static compareInputSchemas(toolName, baselineSchema, currentSchema, issues = []) {
        if (!baselineSchema && !currentSchema) {
            return;
        }
        const baseProps = (baselineSchema?.properties || {});
        const currProps = (currentSchema?.properties || {});
        const baseRequired = new Set(Array.isArray(baselineSchema?.required) ? baselineSchema?.required : []);
        const currRequired = new Set(Array.isArray(currentSchema?.required) ? currentSchema?.required : []);
        // Check newly required properties (breaking: existing callers won't provide them)
        for (const req of currRequired) {
            if (!baseRequired.has(req)) {
                issues.push({
                    tool: toolName,
                    type: "input_required_added",
                    severity: "breaking",
                    path: `arguments.${req}`,
                    message: `Tool '${toolName}' added new required input property '${req}'`,
                });
            }
        }
        // Check property-level constraints for common properties
        for (const [propName, baseProp] of Object.entries(baseProps)) {
            const currProp = currProps[propName];
            if (!currProp) {
                continue;
            }
            // Check enum narrowing (breaking: callers sending an allowed value will now fail)
            if (Array.isArray(baseProp.enum) && Array.isArray(currProp.enum)) {
                const currEnumSet = new Set(currProp.enum);
                const removedEnums = baseProp.enum.filter((val) => !currEnumSet.has(val));
                if (removedEnums.length > 0) {
                    issues.push({
                        tool: toolName,
                        type: "input_enum_removed",
                        severity: "breaking",
                        path: `arguments.${propName}`,
                        message: `Tool '${toolName}' input '${propName}' removed enum values: ${removedEnums.join(", ")}`,
                    });
                }
            }
            // Check type changes
            if (baseProp.type && currProp.type) {
                const baseTypes = this.normalizeTypes(baseProp.type);
                const currTypes = this.normalizeTypes(currProp.type);
                const baseSet = new Set(baseTypes);
                const currSet = new Set(currTypes);
                const areEqual = baseTypes.length === currTypes.length &&
                    baseTypes.every((val, idx) => val === currTypes[idx]);
                if (!areEqual) {
                    // Check if baseline types are all preserved in current types (widened)
                    const allBasePreserved = baseTypes.every((t) => currSet.has(t));
                    if (allBasePreserved && currTypes.length > baseTypes.length) {
                        issues.push({
                            tool: toolName,
                            type: "input_type_widened",
                            severity: "non-breaking",
                            path: `arguments.${propName}`,
                            message: `Tool '${toolName}' input '${propName}' widened accepted types to include: ${currTypes.filter((t) => !baseSet.has(t)).join(", ")}`,
                        });
                    }
                    else {
                        // Some baseline types were removed or changed -> breaking narrowing
                        issues.push({
                            tool: toolName,
                            type: "input_type_narrowed",
                            severity: "breaking",
                            path: `arguments.${propName}`,
                            message: `Tool '${toolName}' input '${propName}' changed type from '${baseTypes.join(" | ")}' to '${currTypes.join(" | ")}'`,
                        });
                    }
                }
            }
        }
    }
    static normalizeTypes(t) {
        if (Array.isArray(t)) {
            return t.map(String).sort();
        }
        if (typeof t === "string") {
            return [t];
        }
        return [];
    }
    static compareOutputSchemas(toolName, baselineSchema, currentSchema, issues = []) {
        if (!baselineSchema || !currentSchema) {
            return;
        }
        const baseProps = (baselineSchema.properties || {});
        const currProps = (currentSchema.properties || {});
        // Check removed output properties (breaking: callers expecting that property will miss it)
        for (const propName of Object.keys(baseProps)) {
            if (!(propName in currProps)) {
                issues.push({
                    tool: toolName,
                    type: "output_property_removed",
                    severity: "breaking",
                    path: `output.${propName}`,
                    message: `Tool '${toolName}' removed output property '${propName}'`,
                });
            }
        }
    }
    static formatReport(diff) {
        if (diff.issues.length === 0) {
            return "ok (contracts match baseline)";
        }
        const lines = [];
        if (diff.breakingCount > 0) {
            lines.push(`CONTRACT BREAKING CHANGES (${diff.breakingCount}):`);
            for (const issue of diff.issues.filter((i) => i.severity === "breaking")) {
                const pathSuffix = issue.path ? ` [${issue.path}]` : "";
                lines.push(`  - [BREAKING] ${issue.tool}${pathSuffix}: ${issue.message}`);
            }
        }
        if (diff.nonBreakingCount > 0) {
            if (lines.length > 0)
                lines.push("");
            lines.push(`Non-breaking changes (${diff.nonBreakingCount}):`);
            for (const issue of diff.issues.filter((i) => i.severity === "non-breaking")) {
                lines.push(`  - [INFO] ${issue.tool}: ${issue.message}`);
            }
        }
        return lines.join("\n");
    }
}
