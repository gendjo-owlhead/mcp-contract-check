export { runContractCheck, formatReport } from "./checker.js";
export { parseCommandLine } from "./command-parser.js";
export { loadFixtures, buildCasesForTools } from "./fixtures.js";
export type {
  CheckOptions,
  CheckSummary,
  CaseResult,
  FixtureCase,
} from "./types.js";
export { validateJsonSchema } from "./validator.js";
