import type { FixtureCase } from "./types.js";
export declare function loadFixtures(casesDir: string): FixtureCase[];
export declare function buildCasesForTools(tools: Array<{
    name: string;
    inputSchema?: Record<string, unknown>;
}>, loadedFixtures: FixtureCase[], options?: {
    fuzz?: boolean;
}): FixtureCase[];
