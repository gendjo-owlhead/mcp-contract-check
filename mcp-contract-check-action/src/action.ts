import * as core from "@actions/core";
import * as github from "@actions/github";
import { runContractCheck } from "@local/mcp-contract-check";
import { verifyLicense } from "./license.js";

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

export async function run(
  customFetch?: typeof fetch
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

    if (isPrivate) {
      const licenseKey = core.getInput("license-key");
      if (!licenseKey) {
        core.setFailed(
          "Private repos require a license: https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00"
        );
        return;
      }

      const repoPayload = github.context.payload?.repository;
      const instanceName =
        repoPayload?.full_name ||
        `${github.context.repo.owner}/${github.context.repo.repo}`;

      const serverUrl =
        core.getInput("license-server-url") ||
        process.env.MCP_LICENSE_SERVER_URL;

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
