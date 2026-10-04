# MCP Contract Check - License Verification Service

A lightweight Node.js/Express microservice that verifies active Stripe subscriptions for private repositories using the `mcp-contract-check` GitHub Action.

---

## Supported License Key Formats

Users can supply any of the following as `license-key`:
1. **Billing Email**: `developer@company.com` (entered during Stripe checkout)
2. **Payment ID**: `pi_...` or Checkout Session ID `cs_...` (from Stripe receipt)
3. **Customer ID**: `cus_...`

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | Your Stripe Secret API key (`sk_live_...` or `sk_test_...`) | **Yes** |
| `PORT` | HTTP port to listen on (defaults to `3000`) | No |

---

## Local Development

```bash
cd license-service
npm install
npm test
npm run dev
```

---

## Deployment Options

### 1. Docker
```bash
docker build -t mcp-license-service .
docker run -p 3000:3000 -e STRIPE_SECRET_KEY="sk_live_..." mcp-license-service
```

### 2. Fly.io
```bash
cd license-service
fly launch
fly secrets set STRIPE_SECRET_KEY="sk_live_..."
fly deploy
```

### 3. Render
1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Root Directory: `license-service`
4. Runtime: `Docker` (or Node with Build Command `npm install && npm run build` and Start Command `npm start`).
5. Add Environment Variable: `STRIPE_SECRET_KEY = sk_live_...`.
