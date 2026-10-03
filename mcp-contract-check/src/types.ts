import type { DiffResult } from "./diff.js";

export interface FixtureCase {
  tool: string;
  arguments?: Record<string, unknown>;
  expected?: "success" | "fail" | "error" | boolean;
  caseFile: string;
}

export interface CaseResult {
  tool: string;
  caseFile: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface CheckOptions {
  command?: string;
  url?: string;
  headers?: Record<string, string>;
  casesDir?: string;
  fuzz?: boolean;
  baseline?: string;
  saveContract?: string;
  timeoutMs?: number;
}

export interface CheckSummary {
  success: boolean;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  results: CaseResult[];
  diff?: DiffResult;
  report?: string;
}
