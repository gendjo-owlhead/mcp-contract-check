import fs from "node:fs";
import path from "node:path";
export function loadFixtures(casesDir) {
    const resolvedDir = path.resolve(process.cwd(), casesDir);
    if (!fs.existsSync(resolvedDir)) {
        return [];
    }
    const stat = fs.statSync(resolvedDir);
    if (!stat.isDirectory()) {
        return [];
    }
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const fixtures = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
            continue;
        }
        const filePath = path.join(resolvedDir, entry.name);
        const relativePath = path.relative(process.cwd(), filePath);
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(content);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
                if (!item || typeof item !== "object") {
                    continue;
                }
                const tool = item.tool ?? item.name ?? item.toolName;
                if (!tool || typeof tool !== "string") {
                    continue;
                }
                const rawExpected = item.expected ?? item.expectedSuccess;
                let expected = "success";
                if (rawExpected === "fail" || rawExpected === "error" || rawExpected === false) {
                    expected = "fail";
                }
                fixtures.push({
                    tool,
                    arguments: (item.arguments ?? item.args ?? item.params ?? {}),
                    expected,
                    caseFile: relativePath || entry.name,
                });
            }
        }
        catch (err) {
            // If a JSON file is invalid, push a case that fails
            fixtures.push({
                tool: entry.name.replace(/\.json$/, ""),
                arguments: {},
                expected: "success",
                caseFile: relativePath || entry.name,
            });
        }
    }
    return fixtures;
}
export function buildCasesForTools(tools, loadedFixtures) {
    const toolNames = new Set(tools.map((t) => t.name));
    const cases = [...loadedFixtures];
    // For any tool that has no fixture, add a default case
    for (const tool of tools) {
        const hasFixture = loadedFixtures.some((f) => f.tool === tool.name);
        if (!hasFixture) {
            cases.push({
                tool: tool.name,
                arguments: {},
                expected: "success",
                caseFile: "(default)",
            });
        }
    }
    return cases;
}
