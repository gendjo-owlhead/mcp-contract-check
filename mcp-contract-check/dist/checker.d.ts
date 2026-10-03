import type { CaseResult, CheckOptions, CheckSummary } from "./types.js";
export declare function formatReport(results: CaseResult[]): string;
export declare function runContractCheck(options: CheckOptions): Promise<CheckSummary>;
