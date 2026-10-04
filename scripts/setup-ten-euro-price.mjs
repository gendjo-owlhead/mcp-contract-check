#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Stripe from 'stripe';

const envPath = path.resolve(process.cwd(), 'license-service/.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY is missing');
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2025-03-31.basil',
});

async function main() {
  console.log('Connecting to Stripe...');

  // 1. Get or find product
  const products = await stripe.products.list({ limit: 10, active: true });
  let product = products.data.find(
    (p) => p.name.toLowerCase() === 'mcp contract check' || p.name.toLowerCase() === 'mcp contract check - team'
  );

  if (!product) {
    product = await stripe.products.create({
      name: 'MCP Contract Check - Lifetime License',
      description: 'One-time payment for lifetime CI/CD contract validation on your private repositories.',
    });
    console.log(`Created product: ${product.id}`);
  } else {
    console.log(`Found product: ${product.id} (${product.name})`);
  }

  // 2. Create the €10 one-time price
  console.log('Creating €10.00 EUR one-time price...');
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000, // 10.00 EUR
    currency: 'eur',
    metadata: {
      tier: 'lifetime_launch',
      display_price: '€10',
    },
  });
  console.log(`Created price: ${price.id} (€10.00 one-time)`);

  // 3. Create single Payment Link
  console.log('Creating Stripe Payment Link for €10...');
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    custom_fields: [
      {
        key: 'github_user_or_org',
        label: {
          type: 'custom',
          custom: 'GitHub Username or Organization',
        },
        type: 'text',
        optional: false,
      },
    ],
    metadata: {
      product: 'mcp-contract-check',
      plan: 'lifetime_10eur',
    },
  });

  const url = paymentLink.url;
  console.log(`\x1b[32m✔ Payment Link created: ${url}\x1b[0m`);

  // 4. Update license-service/src/index.ts
  const indexPath = path.resolve(process.cwd(), 'license-service/src/index.ts');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    content = content.replace(/export const CHECKOUT_URL = "[^"]+";/, `export const CHECKOUT_URL = "${url}";`);
    content = content.replace(/process\.env\.STRIPE_LIFETIME_CHECKOUT_URL \|\|\s+"[^"]+"/, `process.env.STRIPE_LIFETIME_CHECKOUT_URL || "${url}"`);
    content = content.replace(
      /expired\. Subscribe or get a lifetime pass to continue: \$\{CHECKOUT_URL\}/,
      `expired. Get lifetime access for €10: \${CHECKOUT_URL}`
    );
    fs.writeFileSync(indexPath, content, 'utf-8');
    console.log('Updated license-service/src/index.ts');
  }

  // 5. Update README.md
  const readmePath = path.resolve(process.cwd(), 'README.md');
  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf-8');
    // Replace old buy links
    content = content.replace(/https:\/\/buy\.stripe\.com\/[a-zA-Z0-9_-]+/g, url);
    fs.writeFileSync(readmePath, content, 'utf-8');
    console.log('Updated README.md');
  }

  // 6. Update docs/index.html
  const docsPath = path.resolve(process.cwd(), 'docs/index.html');
  if (fs.existsSync(docsPath)) {
    let content = fs.readFileSync(docsPath, 'utf-8');
    content = content.replace(/https:\/\/buy\.stripe\.com\/[a-zA-Z0-9_-]+/g, url);
    fs.writeFileSync(docsPath, content, 'utf-8');
    console.log('Updated docs/index.html');
  }

  console.log('\nAll done! New payment URL:', url);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
