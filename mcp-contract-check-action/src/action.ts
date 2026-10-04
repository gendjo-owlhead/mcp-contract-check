import * as core from "@actions/core";
import * as github from "@actions/github";
import { runContractCheck } from "@local/mcp-contract-check";
import { checkTrial, verifyLicense } from "./license.js";

export function parseHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw || !raw.trim()) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const result: Record<string, string> = {};
        for (const [key, val] of Object.entries(parsed)) {
          result[key] = String(val);
        }
        return result;
      }
    } catch {
      // Fall through to line-based parsing
    }
  }

  const result: Record<string, string> = {};
  const lines = trimmed.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmedLine.slice(0, colonIndex).trim();
      const value = trimmedLine.slice(colonIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function sendTelemetryPing(options: {
  serverUrl?: string;
  mode: "public" | "trial" | "licensed";
  repo: string;
  version?: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  try {
    const defaultUrl = "https://mcp-license-service.onrender.com";
    const baseUrl = (
      options.serverUrl ||
      process.env.MCP_LICENSE_SERVER_URL ||
      defaultUrl
    ).replace(/\/+$/, "");

    const fetcher = options.fetchFn || fetch;
    await fetcher(`${baseUrl}/v1/telemetry/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: options.mode,
        repo: options.repo,
        version: options.version || "1.1.0",
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-blocking telemetry must never fail CI
  }
}

export async function run(
  customFetch?: typeof fetch,
  telemetryFetch?: typeof fetch
): Promise<void> {
  try {
    let isPrivate = false;
    if (github.context.payload?.repository?.private !== undefined) {
      isPrivate = Boolean(github.context.payload.repository.private);
    } else {
      const token = process.env.GITHUB_TOKEN || core.getInput("github-token");
      if (token) {
        try {
          const octokit = github.getOctokit(token);
          const { data: repoData } = await octokit.rest.repos.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
          });
          isPrivate = Boolean(repoData.private);
        } catch {
          isPrivate = true;
        }
      }
    }

    const repoPayload = github.context.payload?.repository;
    const instanceName =
      repoPayload?.full_name ||
      (github.context.repo.owner
        ? `${github.context.repo.owner}/${github.context.repo.repo}`
        : "unknown");

    const serverUrl =
      core.getInput("license-server-url") ||
      process.env.MCP_LICENSE_SERVER_URL;

    const licenseKey = core.getInput("license-key");
    const runMode: "public" | "trial" | "licensed" = isPrivate
      ? licenseKey
        ? "licensed"
        : "trial"
      : "public";

    const effectiveTelemetryFetch =
      telemetryFetch ||
      (process.env.NODE_ENV !== "test" ? customFetch || fetch : undefined);

    if (effectiveTelemetryFetch) {
      await sendTelemetryPing({
        serverUrl: serverUrl || undefined,
        mode: runMode,
        repo: instanceName,
        version: "1.1.0",
        fetchFn: effectiveTelemetryFetch,
      });
    }

    if (isPrivate) {
      if (!licenseKey) {
        const trialResult = await checkTrial({
          instanceName,
          serverUrl: serverUrl || undefined,
          fetchFn: customFetch,
          timeoutMs: 10000,
        });

        if (trialResult.valid && trialResult.trial) {
          const days = trialResult.daysRemaining ?? 14;
          const checkoutUrl =
            trialResult.checkoutUrl ||
            "https://buy.stripe.com/bJe7sMgEM0kA8j20Bs0oM01";
          if (typeof core.notice === "function") {
            core.notice(
              `Running on 14-day evaluation trial for '${instanceName}' (${days} days remaining). Upgrade at ${checkoutUrl} to maintain uninterrupted CI.`
            );
          } else {
            core.info(
              `Running on 14-day evaluation trial for '${instanceName}' (${days} days remaining). Upgrade at ${checkoutUrl}`
            );
          }
        } else {
          core.setFailed(
            trialResult.error ||
              "Private repos require an active license or trial: https://buy.stripe.com/bJe7sMgEM0kA8j20Bs0oM01"
          );
          return;
        }
      } else {
        const licenseResult = await verifyLicense({
          licenseKey,
          instanceName,
          serverUrl: serverUrl || undefined,
          fetchFn: customFetch,
          timeoutMs: 10000,
        });

        if (!licenseResult.valid) {
          core.setFailed(licenseResult.error || "License verification failed");
          return;
        }
      }
    }

    const command = core.getInput("command") || undefined;
    const url = core.getInput("url") || undefined;

    if (!command && !url) {
      core.setFailed("Either 'command' or 'url' must be provided");
      return;
    }

    const cases = core.getInput("cases") || "cases";
    const headers = parseHeaders(core.getInput("headers"));
    const fuzzInput = core.getInput("fuzz");
    const fuzz = fuzzInput === "true" || fuzzInput === "1";
    const baseline = core.getInput("baseline") || undefined;
    const saveContract = core.getInput("save-contract") || undefined;

    const checkSummary = await runContractCheck({
      command,
      url,
      headers,
      casesDir: cases,
      fuzz,
      baseline,
      saveContract,
    });

    if (typeof core.setOutput === "function") {
      core.setOutput("total", String(checkSummary.totalCases));
      core.setOutput("passed", String(checkSummary.passedCases));
      core.setOutput("failed", String(checkSummary.failedCases));
      core.setOutput(
        "compatible",
        checkSummary.diff ? String(checkSummary.diff.compatible) : "true"
      );
    }

    try {
      if (core.summary && typeof core.summary.addHeading === "function") {
        const title = checkSummary.success
          ? "🛡️ MCP Contract Check: Passed"
          : "🛡️ MCP Contract Check: Failed";
        core.summary.addHeading(title, 2);

        const summaryRows: any[] = [
          [
            { data: "Total Cases", header: true },
            { data: "Passed", header: true },
            { data: "Failed", header: true },
            { data: "Status", header: true },
          ],
          [
            String(checkSummary.totalCases),
            String(checkSummary.passedCases),
            String(checkSummary.failedCases),
            checkSummary.success ? "✅ Pass" : "❌ Fail",
          ],
        ];
        core.summary.addTable(summaryRows);

        if (checkSummary.results.length > 0) {
          core.summary.addHeading("Tool Cases", 3);
          const caseRows: any[] = [
            [
              { data: "Tool", header: true },
              { data: "Case", header: true },
              { data: "Expected", header: true },
              { data: "Status", header: true },
            ],
          ];
          for (const res of checkSummary.results) {
            caseRows.push([
              res.tool,
              res.caseFile,
              res.expected,
              res.passed ? "✅ Pass" : "❌ Fail",
            ]);
          }
          core.summary.addTable(caseRows);
        }

        if (checkSummary.diff) {
          core.summary.addHeading("Baseline Contract Compatibility", 3);
          if (checkSummary.diff.issues.length === 0) {
            core.summary.addRaw("✅ All tools match baseline contract.");
          } else {
            const diffRows: any[] = [
              [
                { data: "Tool", header: true },
                { data: "Severity", header: true },
                { data: "Message", header: true },
              ],
            ];
            for (const issue of checkSummary.diff.issues) {
              diffRows.push([
                issue.tool,
                issue.severity === "breaking" ? "🛑 Breaking" : "ℹ️ Info",
                issue.message,
              ]);
            }
            core.summary.addTable(diffRows);
          }
        }

        await core.summary.write();
      }
    } catch {
      // Step summary failure should not abort the action
    }

    if (checkSummary.success) {
      core.info("ok");
    } else {
      core.setFailed(checkSummary.report || "Contract check failed");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.setFailed(`Action failed: ${message}`);
  }
}
