import * as core from "@actions/core";
import * as github from "@actions/github";
import { runContractCheck } from "@local/mcp-contract-check";
import { verifyLicense } from "./license.js";

export async function run(
  customFetch?: typeof fetch
): Promise<void> {
  try {
    const isPrivate = Boolean(github.context.payload?.repository?.private);

    if (isPrivate) {
      const licenseKey = core.getInput("license-key");
      if (!licenseKey) {
        core.setFailed(
          "Private repos require a license: https://buy.stripe.com/test_00w5kEdrja601U7c3AgrS00"
        );
        return;
      }

      const repoPayload = github.context.payload?.repository;
      const instanceName =
        repoPayload?.full_name ||
        `${github.context.repo.owner}/${github.context.repo.repo}`;

      const licenseResult = await verifyLicense({
        licenseKey,
        instanceName,
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
