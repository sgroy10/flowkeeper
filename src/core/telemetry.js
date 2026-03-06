/**
 * SpecLock Telemetry & Analytics (v3.5)
 * Opt-in anonymous usage analytics for product improvement.
 *
 * DISABLED by default. Enable via SPECLOCK_TELEMETRY=true env var.
 * NEVER tracks: lock content, project names, file paths, PII.
 * ONLY tracks: tool usage counts, conflict rates, response times, feature adoption.
 *
 * Data stored locally in .speclock/telemetry.json.
 * Optional remote endpoint via SPECLOCK_TELEMETRY_ENDPOINT env var.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";

const TELEMETRY_FILE = "telemetry.json";
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_EVENTS_BUFFER = 500;

// --- Telemetry state ---

let _enabled = null;
let _buffer = [];
let _flushTimer = null;

/**
 * Check if telemetry is enabled (opt-in only)
 */
export function isTelemetryEnabled() {
  if (_enabled !== null) return _enabled;
  _enabled = process.env.SPECLOCK_TELEMETRY === "true";
  return _enabled;
}

/**
 * Reset telemetry state (for testing)
 */
export function resetTelemetry() {
  _enabled = null;
  _buffer = [];
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

// --- Local telemetry store ---

function telemetryPath(root) {
  return path.join(root, ".speclock", TELEMETRY_FILE);
}

function readTelemetryStore(root) {
  const p = telemetryPath(root);
  if (!fs.existsSync(p)) {
    return createEmptyStore();
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return createEmptyStore();
  }
}

function writeTelemetryStore(root, store) {
  const p = telemetryPath(root);
  fs.writeFileSync(p, JSON.stringify(store, null, 2));
}

function createEmptyStore() {
  return {
    version: "1.0",
    instanceId: generateInstanceId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    toolUsage: {},
    conflicts: { total: 0, blocked: 0, advisory: 0 },
    features: {},
    sessions: { total: 0, tools: {} },
    responseTimes: { samples: [], avgMs: 0 },
    daily: {},
  };
}

function generateInstanceId() {
  // Anonymous instance ID — no PII, just random hex
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// --- Tracking functions ---

/**
 * Track a tool invocation
 */
export function trackToolUsage(root, toolName, durationMs) {
  if (!isTelemetryEnabled()) return;

  const store = readTelemetryStore(root);

  // Tool usage count
  if (!store.toolUsage[toolName]) {
    store.toolUsage[toolName] = { count: 0, totalMs: 0, avgMs: 0 };
  }
  store.toolUsage[toolName].count++;
  store.toolUsage[toolName].totalMs += (durationMs || 0);
  store.toolUsage[toolName].avgMs = Math.round(
    store.toolUsage[toolName].totalMs / store.toolUsage[toolName].count
  );

  // Response time sampling (keep last 100)
  if (durationMs) {
    store.responseTimes.samples.push(durationMs);
    if (store.responseTimes.samples.length > 100) {
      store.responseTimes.samples = store.responseTimes.samples.slice(-100);
    }
    store.responseTimes.avgMs = Math.round(
      store.responseTimes.samples.reduce((a, b) => a + b, 0) / store.responseTimes.samples.length
    );
  }

  // Daily counter
  const today = new Date().toISOString().slice(0, 10);
  if (!store.daily[today]) store.daily[today] = { calls: 0, conflicts: 0 };
  store.daily[today].calls++;

  // Trim daily entries older than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(store.daily)) {
    if (key < cutoffStr) delete store.daily[key];
  }

  store.updatedAt = new Date().toISOString();
  writeTelemetryStore(root, store);
}

/**
 * Track a conflict check result
 */
export function trackConflict(root, hasConflict, blocked) {
  if (!isTelemetryEnabled()) return;

  const store = readTelemetryStore(root);
  store.conflicts.total++;
  if (blocked) {
    store.conflicts.blocked++;
  } else if (hasConflict) {
    store.conflicts.advisory++;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!store.daily[today]) store.daily[today] = { calls: 0, conflicts: 0 };
  if (hasConflict) store.daily[today].conflicts++;

  store.updatedAt = new Date().toISOString();
  writeTelemetryStore(root, store);
}

/**
 * Track feature adoption (which features are being used)
 */
export function trackFeature(root, featureName) {
  if (!isTelemetryEnabled()) return;

  const store = readTelemetryStore(root);
  if (!store.features[featureName]) {
    store.features[featureName] = { firstUsed: new Date().toISOString(), count: 0 };
  }
  store.features[featureName].count++;
  store.features[featureName].lastUsed = new Date().toISOString();

  store.updatedAt = new Date().toISOString();
  writeTelemetryStore(root, store);
}

/**
 * Track session start
 */
export function trackSession(root, toolName) {
  if (!isTelemetryEnabled()) return;

  const store = readTelemetryStore(root);
  store.sessions.total++;
  if (!store.sessions.tools[toolName]) store.sessions.tools[toolName] = 0;
  store.sessions.tools[toolName]++;

  store.updatedAt = new Date().toISOString();
  writeTelemetryStore(root, store);
}

// --- Analytics / Reporting ---

/**
 * Get telemetry summary for dashboard display
 */
export function getTelemetrySummary(root) {
  if (!isTelemetryEnabled()) {
    return { enabled: false, message: "Telemetry is disabled. Set SPECLOCK_TELEMETRY=true to enable." };
  }

  const store = readTelemetryStore(root);

  // Top tools by usage
  const topTools = Object.entries(store.toolUsage)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data }));

  // Daily trend (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, ...(store.daily[key] || { calls: 0, conflicts: 0 }) });
  }

  // Feature adoption
  const features = Object.entries(store.features)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([name, data]) => ({ name, ...data }));

  return {
    enabled: true,
    instanceId: store.instanceId,
    updatedAt: store.updatedAt,
    totalCalls: Object.values(store.toolUsage).reduce((sum, t) => sum + t.count, 0),
    avgResponseMs: store.responseTimes.avgMs,
    conflicts: store.conflicts,
    sessions: store.sessions,
    topTools,
    dailyTrend: days,
    features,
  };
}

// --- Remote telemetry (optional) ---

/**
 * Flush telemetry to remote endpoint if configured.
 * Only sends anonymized aggregate data — never lock content or PII.
 */
export async function flushToRemote(root) {
  if (!isTelemetryEnabled()) return { sent: false, reason: "disabled" };

  const endpoint = process.env.SPECLOCK_TELEMETRY_ENDPOINT;
  if (!endpoint) return { sent: false, reason: "no endpoint configured" };

  const summary = getTelemetrySummary(root);
  if (!summary.enabled) return { sent: false, reason: "disabled" };

  // Build anonymized payload
  const payload = {
    instanceId: summary.instanceId,
    version: "4.5.5",
    totalCalls: summary.totalCalls,
    avgResponseMs: summary.avgResponseMs,
    conflicts: summary.conflicts,
    sessions: summary.sessions,
    topTools: summary.topTools.map(t => ({ name: t.name, count: t.count })),
    features: summary.features.map(f => ({ name: f.name, count: f.count })),
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return { sent: true, status: response.status };
  } catch {
    return { sent: false, reason: "network error" };
  }
}
