import Stripe from "stripe";

export interface VerifyStripeLicenseResult {
  valid: boolean;
  error?: string;
  lifetime?: boolean;
  subscription?: {
    id: string;
    status: string;
    customer: string;
    currentPeriodEnd: number;
  };
  payment?: {
    id: string;
    status: string;
    customer?: string;
    amount?: number;
  };
}

export interface VerifyStripeLicenseOptions {
  licenseKey: string;
  instanceName?: string;
  stripeClient?: Stripe;
}

export async function verifyStripeSubscription(
  options: VerifyStripeLicenseOptions
): Promise<VerifyStripeLicenseResult> {
  const { licenseKey } = options;
  const trimmedKey = licenseKey.trim();

  if (!trimmedKey) {
    return { valid: false, error: "License key cannot be empty" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const stripe = options.stripeClient ?? (secretKey ? new Stripe(secretKey) : null);

  if (!stripe) {
    return {
      valid: false,
      error: "Stripe is not configured on the license verification server",
    };
  }

  try {
    // 1. If key is a subscription ID (sub_...)
    if (trimmedKey.startsWith("sub_")) {
      const subscription = await stripe.subscriptions.retrieve(trimmedKey);
      if (subscription.status === "active" || subscription.status === "trialing") {
        return {
          valid: true,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            customer: String(subscription.customer),
            currentPeriodEnd: subscription.current_period_end,
          },
        };
      }
      return {
        valid: false,
        error: `Subscription ${trimmedKey} is not active (current status: ${subscription.status})`,
      };
    }

    // 2. If key is a PaymentIntent ID (pi_...) for one-time lifetime purchase
    if (trimmedKey.startsWith("pi_")) {
      const pi = await stripe.paymentIntents.retrieve(trimmedKey);
      if (pi.status === "succeeded") {
        return {
          valid: true,
          lifetime: true,
          payment: {
            id: pi.id,
            status: pi.status,
            customer: pi.customer ? String(pi.customer) : undefined,
            amount: pi.amount,
          },
        };
      }
      return {
        valid: false,
        error: `PaymentIntent ${trimmedKey} has status '${pi.status}', expected 'succeeded'`,
      };
    }

    // 3. If key is a Checkout Session ID (cs_...) for one-time lifetime purchase
    if (trimmedKey.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(trimmedKey);
      if (session.payment_status === "paid") {
        return {
          valid: true,
          lifetime: true,
          payment: {
            id: session.id,
            status: session.payment_status,
            customer: session.customer ? String(session.customer) : undefined,
            amount: session.amount_total ?? undefined,
          },
        };
      }
      return {
        valid: false,
        error: `Checkout session ${trimmedKey} is unpaid (status: ${session.payment_status})`,
      };
    }

    // 4. If key is a customer ID (cus_...)
    if (trimmedKey.startsWith("cus_")) {
      const subscriptions = await stripe.subscriptions.list({
        customer: trimmedKey,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        return {
          valid: true,
          subscription: {
            id: sub.id,
            status: sub.status,
            customer: String(sub.customer),
            currentPeriodEnd: sub.current_period_end,
          },
        };
      }

      // Check if customer completed a one-time lifetime payment
      if (stripe.paymentIntents && typeof stripe.paymentIntents.list === "function") {
        const payments = await stripe.paymentIntents.list({
          customer: trimmedKey,
          limit: 5,
        });
        const succeeded = payments.data.find((p) => p.status === "succeeded");
        if (succeeded) {
          return {
            valid: true,
            lifetime: true,
            payment: {
              id: succeeded.id,
              status: succeeded.status,
              customer: trimmedKey,
              amount: succeeded.amount,
            },
          };
        }
      }

      return {
        valid: false,
        error: `Customer ${trimmedKey} has no active subscription or lifetime purchase`,
      };
    }

    // 5. If key is an email address
    if (trimmedKey.includes("@")) {
      const customers = await stripe.customers.list({
        email: trimmedKey,
        limit: 5,
      });

      if (customers.data.length === 0) {
        return {
          valid: false,
          error: `No Stripe customer found with email ${trimmedKey}`,
        };
      }

      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          return {
            valid: true,
            subscription: {
              id: sub.id,
              status: sub.status,
              customer: customer.id,
              currentPeriodEnd: sub.current_period_end,
            },
          };
        }

        // Check for one-time lifetime purchase
        if (stripe.paymentIntents && typeof stripe.paymentIntents.list === "function") {
          const payments = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 5,
          });
          const succeeded = payments.data.find((p) => p.status === "succeeded");
          if (succeeded) {
            return {
              valid: true,
              lifetime: true,
              payment: {
                id: succeeded.id,
                status: succeeded.status,
                customer: customer.id,
                amount: succeeded.amount,
              },
            };
          }
        }
      }

      return {
        valid: false,
        error: `No active subscription or lifetime purchase found for email ${trimmedKey}`,
      };
    }

    return {
      valid: false,
      error: `Invalid license key format: expected Stripe Subscription ID (sub_...), Payment ID (pi_...), Customer ID (cus_...), or billing email`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Stripe verification error: ${message}`,
    };
  }
}
