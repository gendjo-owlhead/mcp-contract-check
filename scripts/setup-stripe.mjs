#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Stripe from 'stripe';

// 1. Load environment variables from license-service/.env or root .env
const envPaths = [
  path.resolve(process.cwd(), 'license-service/.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error('\x1b[31mError: STRIPE_SECRET_KEY is not defined in license-service/.env or environment.\x1b[0m');
  console.error('Please add STRIPE_SECRET_KEY to license-service/.env');
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2025-03-31.basil',
});

async function main() {
  console.log('Connecting to Stripe...');

  // 1. Verify credentials by fetching account details
  let account;
  try {
    account = await stripe.accounts.retrieve();
    console.log(`Connected to Stripe account: ${account.business_profile?.name || account.id} (Live mode: ${!secretKey.startsWith('sk_test_') && !secretKey.startsWith('rk_test_')})`);
  } catch (err) {
    // If restricted key doesn't have accounts:read, test by listing products
    try {
      await stripe.products.list({ limit: 1 });
      console.log('Connected to Stripe successfully.');
    } catch (innerErr) {
      console.error('\x1b[31mFailed to authenticate with Stripe:\x1b[0m', innerErr.message);
      process.exit(1);
    }
  }

  // 2. Create or find Product
  console.log('Checking for existing "MCP Contract Check - Team" product...');
  const existingProducts = await stripe.products.list({ limit: 10, active: true });
  let product = existingProducts.data.find(
    (p) => p.name.toLowerCase() === 'mcp contract check - team' || p.name.toLowerCase() === 'mcp contract check'
  );

  if (!product) {
    console.log('Creating product "MCP Contract Check - Team"...');
    product = await stripe.products.create({
      name: 'MCP Contract Check - Team',
      description: 'Automated MCP schema validation and contract testing in CI for your entire GitHub Organization.',
      metadata: {
        app: 'mcp-contract-check',
        tier: 'team',
      },
    });
    console.log(`Created product: ${product.id}`);
  } else {
    console.log(`Using existing product: ${product.id} (${product.name})`);
  }

  // 3. Create or find Monthly Price (e.g. 29.00 EUR)
  const existingPrices = await stripe.prices.list({ product: product.id, active: true });
  let monthlyPrice = existingPrices.data.find(
    (pr) => pr.type === 'recurring' && pr.recurring?.interval === 'month' && pr.currency === 'eur'
  );

  if (!monthlyPrice) {
    console.log('Creating monthly recurring price: €29.00 EUR / month...');
    monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900,
      currency: 'eur',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: 'monthly',
      },
    });
    console.log(`Created monthly price: ${monthlyPrice.id}`);
  } else {
    console.log(`Using existing monthly price: ${monthlyPrice.id} (€${(monthlyPrice.unit_amount || 0) / 100} / month)`);
  }

  // 4. Create or find Lifetime Price (e.g. 149.00 EUR one-time)
  let lifetimePrice = existingPrices.data.find(
    (pr) => pr.type === 'one_time' && pr.currency === 'eur'
  );

  if (!lifetimePrice) {
    console.log('Creating lifetime one-time price: €149.00 EUR...');
    lifetimePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 14900,
      currency: 'eur',
      metadata: {
        tier: 'lifetime',
      },
    });
    console.log(`Created lifetime price: ${lifetimePrice.id}`);
  } else {
    console.log(`Using existing lifetime price: ${lifetimePrice.id} (€${(lifetimePrice.unit_amount || 0) / 100} one-time)`);
  }

  // 5. Create Payment Link for Monthly Subscription
  console.log('Generating Monthly Subscription Payment Link...');
  const monthlyPaymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: monthlyPrice.id,
        quantity: 1,
      },
    ],
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    custom_fields: [
      {
        key: 'github_org',
        label: {
          type: 'custom',
          custom: 'GitHub Organization or Account',
        },
        type: 'text',
        optional: false,
      },
    ],
    metadata: {
      plan: 'team_monthly',
    },
  });
  console.log(`\x1b[32mMonthly Payment Link URL: ${monthlyPaymentLink.url}\x1b[0m`);

  // 6. Create Payment Link for Lifetime Pass
  console.log('Generating Lifetime Pass Payment Link...');
  const lifetimePaymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: lifetimePrice.id,
        quantity: 1,
      },
    ],
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    custom_fields: [
      {
        key: 'github_org',
        label: {
          type: 'custom',
          custom: 'GitHub Organization or Account',
        },
        type: 'text',
        optional: false,
      },
    ],
    metadata: {
      plan: 'team_lifetime',
    },
  });
  console.log(`\x1b[32mLifetime Payment Link URL: ${lifetimePaymentLink.url}\x1b[0m`);

  // 7. Update URLs in codebase
  const indexPath = path.resolve(process.cwd(), 'license-service/src/index.ts');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    content = content.replace(/CHECKOUT_URL = "[^"]+"/, `CHECKOUT_URL = "${monthlyPaymentLink.url}"`);
    content = content.replace(/process\.env\.STRIPE_LIFETIME_CHECKOUT_URL \|\|\s+"[^"]+"/, `process.env.STRIPE_LIFETIME_CHECKOUT_URL || "${lifetimePaymentLink.url}"`);
    fs.writeFileSync(indexPath, content, 'utf-8');
    console.log('Updated license-service/src/index.ts with new Stripe URLs.');
  }

  const readmePath = path.resolve(process.cwd(), 'README.md');
  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf-8');
    content = content.replace(/https:\/\/buy\.stripe\.com\/14A28sgEM0kAdDm4RI0oM00/g, monthlyPaymentLink.url);
    content = content.replace(/https:\/\/buy\.stripe\.com\/bJe7sMgEM0kA8j20Bs0oM01/g, lifetimePaymentLink.url);
    fs.writeFileSync(readmePath, content, 'utf-8');
    console.log('Updated README.md with new Stripe URLs.');
  }

  const docsPath = path.resolve(process.cwd(), 'docs/index.html');
  if (fs.existsSync(docsPath)) {
    let content = fs.readFileSync(docsPath, 'utf-8');
    content = content.replace(/https:\/\/buy\.stripe\.com\/14A28sgEM0kAdDm4RI0oM00/g, monthlyPaymentLink.url);
    content = content.replace(/https:\/\/buy\.stripe\.com\/bJe7sMgEM0kA8j20Bs0oM01/g, lifetimePaymentLink.url);
    fs.writeFileSync(docsPath, content, 'utf-8');
    console.log('Updated docs/index.html with new Stripe URLs.');
  }

  console.log('\n\x1b[32m✔ Stripe setup completed successfully!\x1b[0m');
  console.log('Monthly Link:', monthlyPaymentLink.url);
  console.log('Lifetime Link:', lifetimePaymentLink.url);
}

main().catch((err) => {
  console.error('\x1b[31mSetup failed:\x1b[0m', err);
  process.exit(1);
});
