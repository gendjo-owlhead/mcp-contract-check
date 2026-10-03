import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { verifyStripeSubscription } from "../src/stripe.js";
import { app } from "../src/index.js";

describe("verifyStripeSubscription", () => {
  it("rejects empty license key", async () => {
    const result = await verifyStripeSubscription({ licenseKey: "   " });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cannot be empty");
  });

  it("validates active subscription by sub_ id", async () => {
    const mockStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_123",
          status: "active",
          customer: "cus_abc",
          current_period_end: 1700000000,
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "sub_123",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.subscription?.id).toBe("sub_123");
    expect(result.subscription?.status).toBe("active");
  });

  it("rejects canceled subscription by sub_ id", async () => {
    const mockStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_canceled",
          status: "canceled",
          customer: "cus_abc",
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "sub_canceled",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("is not active");
  });

  it("validates active subscription by cus_ id", async () => {
    const mockStripe = {
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub_active_cus",
              status: "active",
              customer: "cus_123",
              current_period_end: 1700000000,
            },
          ],
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "cus_123",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.subscription?.id).toBe("sub_active_cus");
  });

  it("validates active subscription by customer email", async () => {
    const mockStripe = {
      customers: {
        list: vi.fn().mockResolvedValue({
          data: [{ id: "cus_email_user" }],
        }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub_email_active",
              status: "active",
              customer: "cus_email_user",
              current_period_end: 1700000000,
            },
          ],
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "dev@company.com",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.subscription?.id).toBe("sub_email_active");
  });
});

describe("Express API Endpoints", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /v1/licenses/validate requires license_key", async () => {
    const res = await request(app).post("/v1/licenses/validate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("license_key is required");
  });

  it("POST /v1/licenses/trial starts a 14-day trial", async () => {
    const res = await request(app)
      .post("/v1/licenses/trial")
      .send({ instance_name: "test-org/private-repo" });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.trial).toBe(true);
    expect(res.body.daysRemaining).toBe(14);
    expect(res.body.checkoutUrl).toBeDefined();
  });

  it("POST /v1/licenses/trial rejects missing instance_name", async () => {
    const res = await request(app).post("/v1/licenses/trial").send({});
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });
});
