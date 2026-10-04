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

  it("validates one-time lifetime payment by pi_ id", async () => {
    const mockStripe = {
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_123lifetime",
          status: "succeeded",
          customer: "cus_lifetime",
          amount: 7900,
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "pi_123lifetime",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.lifetime).toBe(true);
    expect(result.payment?.id).toBe("pi_123lifetime");
    expect(result.payment?.status).toBe("succeeded");
    expect(result.payment?.amount).toBe(7900);
  });

  it("rejects non-succeeded payment intent by pi_ id", async () => {
    const mockStripe = {
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({
          id: "pi_failed",
          status: "requires_payment_method",
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "pi_failed",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("requires_payment_method");
  });

  it("validates one-time lifetime payment by cs_ checkout session id", async () => {
    const mockStripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            id: "cs_session_456",
            payment_status: "paid",
            customer: "cus_session_user",
            amount_total: 7900,
          }),
        },
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "cs_session_456",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.lifetime).toBe(true);
    expect(result.payment?.id).toBe("cs_session_456");
    expect(result.payment?.status).toBe("paid");
  });

  it("validates one-time lifetime payment by cus_ id when no active subscription", async () => {
    const mockStripe = {
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [],
        }),
      },
      paymentIntents: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "pi_cust_lifetime",
              status: "succeeded",
              amount: 7900,
            },
          ],
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "cus_paid_once",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.lifetime).toBe(true);
    expect(result.payment?.id).toBe("pi_cust_lifetime");
  });

  it("validates one-time lifetime payment by customer email when no active subscription", async () => {
    const mockStripe = {
      customers: {
        list: vi.fn().mockResolvedValue({
          data: [{ id: "cus_email_lifetime" }],
        }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [],
        }),
      },
      paymentIntents: {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: "pi_email_lifetime",
              status: "succeeded",
              amount: 7900,
            },
          ],
        }),
      },
    };

    const result = await verifyStripeSubscription({
      licenseKey: "buyer@domain.com",
      stripeClient: mockStripe as any,
    });

    expect(result.valid).toBe(true);
    expect(result.lifetime).toBe(true);
    expect(result.payment?.id).toBe("pi_email_lifetime");
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
