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
