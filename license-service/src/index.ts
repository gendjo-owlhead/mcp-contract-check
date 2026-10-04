import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { verifyStripeSubscription } from "./stripe.js";

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "mcp-contract-check-license-service",
    timestamp: new Date().toISOString(),
  });
});

export const CHECKOUT_URL = "https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00";
export const LIFETIME_CHECKOUT_URL =
  process.env.STRIPE_LIFETIME_CHECKOUT_URL ||
  "https://buy.stripe.com/bJe7sMgEM0kA8j20Bs0oM01";
export const TRIAL_DURATION_DAYS = 14;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface TrialRecord {
  instanceName: string;
  createdAt: number;
}

export const trialStore = new Map<string, TrialRecord>();

app.post("/v1/licenses/trial", (req: Request, res: Response) => {
  const instanceName = (
    req.body.instance_name ||
    req.body.instanceName ||
    ""
  ).trim();

  if (!instanceName) {
    res.status(400).json({
      valid: false,
      error: "instance_name is required for trial evaluation",
    });
    return;
  }

  const normalized = instanceName.toLowerCase();
  let record = trialStore.get(normalized);
  const now = Date.now();

  if (!record) {
    record = { instanceName: normalized, createdAt: now };
    trialStore.set(normalized, record);
  }

  const elapsedMs = now - record.createdAt;
  const remainingMs = TRIAL_DURATION_MS - elapsedMs;

  if (remainingMs > 0) {
    const daysRemaining = Math.max(
      1,
      Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
    );
    res.json({
      valid: true,
      trial: true,
      daysRemaining,
      expiresAt: new Date(record.createdAt + TRIAL_DURATION_MS).toISOString(),
      checkoutUrl: CHECKOUT_URL,
      lifetimeCheckoutUrl: LIFETIME_CHECKOUT_URL,
    });
  } else {
    res.json({
      valid: false,
      trial: false,
      trialExpired: true,
      error: `14-day trial for '${instanceName}' expired. Subscribe or get a lifetime pass to continue: ${CHECKOUT_URL}`,
      checkoutUrl: CHECKOUT_URL,
      lifetimeCheckoutUrl: LIFETIME_CHECKOUT_URL,
    });
  }
});

app.post("/v1/licenses/validate", async (req: Request, res: Response) => {
  const licenseKey = (req.body.license_key || req.body.licenseKey || "") as string;
  const instanceName = (req.body.instance_name || req.body.instanceName || "") as string;

  if (!licenseKey.trim()) {
    res.status(400).json({ valid: false, error: "license_key is required" });
    return;
  }

  const result = await verifyStripeSubscription({
    licenseKey,
    instanceName,
  });

  if (result.valid) {
    res.json({
      valid: true,
      instance: instanceName ? { name: instanceName } : null,
      subscription: result.subscription,
      lifetime: result.lifetime,
      payment: result.payment,
    });
  } else {
    res.json({
      valid: false,
      error: result.error || "License verification failed",
    });
  }
});

app.post("/v1/licenses/activate", async (req: Request, res: Response) => {
  const licenseKey = (req.body.license_key || req.body.licenseKey || "") as string;
  const instanceName = (req.body.instance_name || req.body.instanceName || "") as string;

  if (!licenseKey.trim()) {
    res.status(400).json({ valid: false, error: "license_key is required" });
    return;
  }

  const result = await verifyStripeSubscription({
    licenseKey,
    instanceName,
  });

  if (result.valid) {
    res.json({
      valid: true,
      instance: instanceName ? { name: instanceName } : null,
      subscription: result.subscription,
      lifetime: result.lifetime,
      payment: result.payment,
    });
  } else {
    res.json({
      valid: false,
      error: result.error || "License activation failed",
    });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`License verification microservice running on port ${PORT}`);
  });
}
