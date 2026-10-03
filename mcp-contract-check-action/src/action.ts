import * as core from "@actions/core";
import * as github from "@actions/github";
import { runContractCheck } from "@local/mcp-contract-check";
import { verifyLicense } from "./license.js";

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

    const command = core.getInput("command", { required: true });
    const cases = core.getInput("cases") || "cases";

    const checkSummary = await runContractCheck({
      command,
      casesDir: cases,
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
