import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import { verifyStripeSubscription } from "./stripe.js";
dotenv.config();
export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
});
app.use("/v1/", apiLimiter);
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "mcp-contract-check-license-service",
        timestamp: new Date().toISOString(),
    });
});
export const CHECKOUT_URL = "https://buy.stripe.com/28E00k3S02sI9n6ac20oM04";
export const LIFETIME_CHECKOUT_URL = process.env.STRIPE_LIFETIME_CHECKOUT_URL || "https://buy.stripe.com/28E00k3S02sI9n6ac20oM04";
export const TRIAL_DURATION_DAYS = 14;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
const db = new Database(process.env.DB_PATH || "db.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS trials (
    instanceName TEXT PRIMARY KEY,
    createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    mode TEXT,
    repo TEXT,
    version TEXT
  );
`);
const insertTrial = db.prepare("INSERT OR IGNORE INTO trials (instanceName, createdAt) VALUES (?, ?)");
const getTrial = db.prepare("SELECT * FROM trials WHERE instanceName = ?");
const getAllTrialsStmt = db.prepare("SELECT * FROM trials ORDER BY createdAt DESC");
const insertTelemetry = db.prepare("INSERT INTO telemetry (timestamp, mode, repo, version) VALUES (?, ?, ?, ?)");
const getRecentTelemetry = db.prepare("SELECT * FROM telemetry ORDER BY id DESC LIMIT 50");
const getTelemetryStats = db.prepare(`
  SELECT 
    COUNT(*) as totalRuns,
    SUM(CASE WHEN mode = 'public' THEN 1 ELSE 0 END) as publicRuns,
    SUM(CASE WHEN mode = 'trial' THEN 1 ELSE 0 END) as trialRuns,
    SUM(CASE WHEN mode = 'licensed' THEN 1 ELSE 0 END) as licensedRuns
  FROM telemetry
`);
export function getTrialRecord(instanceName) {
    return getTrial.get(instanceName);
}
export function createTrialRecord(instanceName) {
    const trial = { instanceName, createdAt: Date.now() };
    insertTrial.run(trial.instanceName, trial.createdAt);
    return trial;
}
export function getAllTrials() {
    return getAllTrialsStmt.all();
}
export function recordRun(data) {
    const mode = data.mode === "trial" || data.mode === "licensed"
        ? data.mode
        : "public";
    insertTelemetry.run(new Date().toISOString(), mode, data.repo || "anonymous", data.version || "1.1.0");
}
export function getTelemetryData() {
    const stats = getTelemetryStats.get();
    const recentRuns = getRecentTelemetry.all();
    return {
        totalRuns: stats.totalRuns || 0,
        publicRuns: stats.publicRuns || 0,
        trialRuns: stats.trialRuns || 0,
        licensedRuns: stats.licensedRuns || 0,
        recentRuns,
    };
}
app.post("/v1/telemetry/ping", (req, res) => {
    const mode = (req.body.mode || "public");
    const repo = (req.body.repo || req.body.instance_name || "anonymous");
    const version = (req.body.version || "1.1.0");
    recordRun({ mode, repo, version });
    res.json({ ok: true, totalRuns: getTelemetryData().totalRuns });
});
app.get(["/stats", "/v1/telemetry/stats"], (req, res) => {
    const escapeHtml = (unsafe) => String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const trials = getAllTrials().map((t) => {
        const elapsedMs = Date.now() - t.createdAt;
        const remainingMs = TRIAL_DURATION_MS - elapsedMs;
        const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
        return {
            instanceName: t.instanceName,
            createdAt: new Date(t.createdAt).toISOString(),
            expired: remainingMs <= 0,
            daysRemaining,
        };
    });
    const telemetry = getTelemetryData();
    const payload = {
        status: "ok",
        total_runs: telemetry.totalRuns,
        runs_by_mode: {
            public: telemetry.publicRuns,
            trial: telemetry.trialRuns,
            licensed: telemetry.licensedRuns,
        },
        active_trials_count: trials.filter((t) => !t.expired).length,
        trials,
        recent_runs: telemetry.recentRuns,
    };
    const wantsHtml = req.headers.accept?.includes("text/html") &&
        req.query.format !== "json";
    if (!wantsHtml) {
        res.json(payload);
        return;
    }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Contract Check - Live Operations & Telemetry</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --blue: #58a6ff;
      --green: #3fb950;
      --orange: #d29922;
      --purple: #bc8cff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 2.5rem 1.5rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    h1 { color: var(--heading); font-size: 1.75rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
    p.subtitle { color: #8b949e; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; }
    .card .label { font-size: 0.85rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .card .val { font-size: 2.25rem; font-weight: 700; color: var(--heading); margin-top: 0.4rem; }
    .card.blue .val { color: var(--blue); }
    .card.green .val { color: var(--green); }
    .card.orange .val { color: var(--orange); }
    .card.purple .val { color: var(--purple); }
    h2 { color: var(--heading); font-size: 1.25rem; margin: 2rem 0 1rem 0; }
    table { width: 100%; border-collapse: collapse; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    th { background: #21262d; color: var(--heading); font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .badge-public { background: rgba(88, 166, 255, 0.15); color: var(--blue); }
    .badge-trial { background: rgba(210, 153, 34, 0.15); color: var(--orange); }
    .badge-licensed { background: rgba(63, 185, 80, 0.15); color: var(--green); }
    .empty { color: #8b949e; font-style: italic; padding: 1.5rem; text-align: center; }
  </style>
</head>
<body>
  <h1>🛡️ MCP Contract Check Telemetry</h1>
  <p class="subtitle">Live tracking of GitHub Actions runs, evaluation trials, and commercial licenses.</p>

  <div class="grid">
    <div class="card blue">
      <div class="label">Total Action Runs</div>
      <div class="val">${payload.total_runs}</div>
    </div>
    <div class="card purple">
      <div class="label">Community (Public)</div>
      <div class="val">${payload.runs_by_mode.public}</div>
    </div>
    <div class="card orange">
      <div class="label">Active Trials</div>
      <div class="val">${payload.active_trials_count}</div>
    </div>
    <div class="card green">
      <div class="label">Licensed Runs</div>
      <div class="val">${payload.runs_by_mode.licensed}</div>
    </div>
  </div>

  <h2>Active 14-Day Evaluation Trials</h2>
  <table>
    <thead>
      <tr>
        <th>Repository / Instance</th>
        <th>Started At</th>
        <th>Days Remaining</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${trials.length === 0
        ? '<tr><td colspan="4" class="empty">No active private evaluation trials recorded yet</td></tr>'
        : trials
            .map((t) => `<tr>
            <td><code>${escapeHtml(t.instanceName)}</code></td>
            <td>${t.createdAt.slice(0, 10)}</td>
            <td>${t.daysRemaining} days</td>
            <td><span class="badge ${t.expired ? "badge-trial" : "badge-licensed"}">${t.expired ? "Expired" : "Active"}</span></td>
          </tr>`)
            .join("")}
    </tbody>
  </table>

  <h2>Recent Action Executions</h2>
  <table>
    <thead>
      <tr>
        <th>Time (UTC)</th>
        <th>Repository</th>
        <th>Mode</th>
        <th>Version</th>
      </tr>
    </thead>
    <tbody>
      ${payload.recent_runs.length === 0
        ? '<tr><td colspan="4" class="empty">No recent action runs recorded yet</td></tr>'
        : payload.recent_runs
            .map((r) => `<tr>
            <td>${r.timestamp.replace("T", " ").slice(0, 19)}</td>
            <td><code>${escapeHtml(r.repo)}</code></td>
            <td><span class="badge badge-${escapeHtml(r.mode)}">${escapeHtml(r.mode)}</span></td>
            <td>${escapeHtml(r.version || "")}</td>
          </tr>`)
            .join("")}
    </tbody>
  </table>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
});
app.post("/v1/licenses/trial", (req, res) => {
    const instanceName = (req.body.instance_name ||
        req.body.instanceName ||
        "").trim();
    if (!instanceName) {
        res.status(400).json({
            valid: false,
            error: "instance_name is required for trial evaluation",
        });
        return;
    }
    const normalized = instanceName.toLowerCase();
    let record = getTrialRecord(normalized);
    const now = Date.now();
    if (!record) {
        record = createTrialRecord(normalized);
    }
    recordRun({ mode: "trial", repo: normalized, version: req.body.version });
    const elapsedMs = now - record.createdAt;
    const remainingMs = TRIAL_DURATION_MS - elapsedMs;
    if (remainingMs > 0) {
        const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
        res.json({
            valid: true,
            trial: true,
            daysRemaining,
            expiresAt: new Date(record.createdAt + TRIAL_DURATION_MS).toISOString(),
            checkoutUrl: CHECKOUT_URL,
            lifetimeCheckoutUrl: LIFETIME_CHECKOUT_URL,
        });
    }
    else {
        res.json({
            valid: false,
            trial: false,
            trialExpired: true,
            error: `14-day trial for '${instanceName}' expired. Get lifetime access for €10: ${CHECKOUT_URL}`,
            checkoutUrl: CHECKOUT_URL,
            lifetimeCheckoutUrl: LIFETIME_CHECKOUT_URL,
        });
    }
});
app.post("/v1/licenses/validate", async (req, res) => {
    const licenseKey = (req.body.license_key || req.body.licenseKey || "");
    const instanceName = (req.body.instance_name || req.body.instanceName || "");
    if (!licenseKey.trim()) {
        res.status(400).json({ valid: false, error: "license_key is required" });
        return;
    }
    const result = await verifyStripeSubscription({
        licenseKey,
        instanceName,
    });
    if (result.valid) {
        recordRun({ mode: "licensed", repo: instanceName, version: req.body.version });
        res.json({
            valid: true,
            instance: instanceName ? { name: instanceName } : null,
            subscription: result.subscription,
            lifetime: result.lifetime,
            payment: result.payment,
        });
    }
    else {
        res.json({
            valid: false,
            error: result.error || "License verification failed",
        });
    }
});
app.post("/v1/licenses/activate", async (req, res) => {
    const licenseKey = (req.body.license_key || req.body.licenseKey || "");
    const instanceName = (req.body.instance_name || req.body.instanceName || "");
    if (!licenseKey.trim()) {
        res.status(400).json({ valid: false, error: "license_key is required" });
        return;
    }
    const result = await verifyStripeSubscription({
        licenseKey,
        instanceName,
    });
    if (result.valid) {
        recordRun({ mode: "licensed", repo: instanceName, version: req.body.version });
        res.json({
            valid: true,
            instance: instanceName ? { name: instanceName } : null,
            subscription: result.subscription,
            lifetime: result.lifetime,
            payment: result.payment,
        });
    }
    else {
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
