/**
 * SpecLock Telemetry & Analytics (v5.5)
 * Opt-in anonymous usage analytics for product improvement.
 *
 * Two coexisting layers:
 *
 *  1) Legacy per-project telemetry (v3.5+):
 *     Stored in <projectRoot>/.speclock/telemetry.json.
 *     Controlled by the SPECLOCK_TELEMETRY env var.
 *     Used by trackToolUsage / trackConflict / trackFeature / trackSession
 *     and surfaced by getTelemetrySummary.
 *
 *  2) Global opt-in CLI telemetry (investor request):
 *     Stored in ~/.speclock/telemetry.jsonl  (append-only JSON lines)
 *     Config in ~/.speclock/telemetry.json    ({ enabled: true|false, decidedAt })
 *     Install id in ~/.speclock/install-id    (random UUID, generated once)
 *     Controlled by `speclock telemetry on|off` or SPECLOCK_TELEMETRY=1.
 *     Used by recordCommand() from the CLI entrypoint — fire-and-forget.
 *
 * Privacy:
 *   NEVER records: file contents, commit messages, lock content, user names,
 *   paths, IP addresses, or any personally identifying information.
 *   ONLY records: install-id (random UUID), version, platform, node version,
 *   which subcommand was run, exit code, enforcement mode, number of locks,
 *   count of rule files, list of MCP clients wired up, and days since install.
 *
 * Resilience:
 *   All telemetry operations are wrapped in try/catch and must NEVER block
 *   or break the caller. Remote sends use a 1-second timeout and swallow
 *   every error.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// LEGACY (per-project) TELEMETRY — preserved for backward compatibility.
// ---------------------------------------------------------------------------

const TELEMETRY_FILE = "telemetry.json";

let _enabled = null;

/**
 * Check if telemetry is enabled (opt-in only) — legacy env-var path.
 * Returns true if SPECLOCK_TELEMETRY is "true" or "1".
 */
export function isTelemetryEnabled() {
  if (_enabled !== null) return _enabled;
  const v = process.env.SPECLOCK_TELEMETRY;
  _enabled = v === "true" || v === "1";
  return _enabled;
}

/**
 * Reset telemetry state (primarily for tests).
 */
export function resetTelemetry() {
  _enabled = null;
}

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
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(store, null, 2));
  } catch {
    /* swallow — telemetry must never break callers */
  }
}

function createEmptyStore() {
  return {
    version: "1.0",
    instanceId: generateLegacyInstanceId(),
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

function generateLegacyInstanceId() {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Track a tool invocation (legacy).
 */
export function trackToolUsage(root, toolName, durationMs) {
  if (!isTelemetryEnabled()) return;
  try {
    const store = readTelemetryStore(root);
    if (!store.toolUsage[toolName]) {
      store.toolUsage[toolName] = { count: 0, totalMs: 0, avgMs: 0 };
    }
    store.toolUsage[toolName].count++;
    store.toolUsage[toolName].totalMs += (durationMs || 0);
    store.toolUsage[toolName].avgMs = Math.round(
      store.toolUsage[toolName].totalMs / store.toolUsage[toolName].count
    );

    if (durationMs) {
      store.responseTimes.samples.push(durationMs);
      if (store.responseTimes.samples.length > 100) {
        store.responseTimes.samples = store.responseTimes.samples.slice(-100);
      }
      store.responseTimes.avgMs = Math.round(
        store.responseTimes.samples.reduce((a, b) => a + b, 0) /
          store.responseTimes.samples.length
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!store.daily[today]) store.daily[today] = { calls: 0, conflicts: 0 };
    store.daily[today].calls++;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const key of Object.keys(store.daily)) {
      if (key < cutoffStr) delete store.daily[key];
    }

    store.updatedAt = new Date().toISOString();
    writeTelemetryStore(root, store);
  } catch { /* swallow */ }
}

/**
 * Track a conflict check result (legacy).
 */
export function trackConflict(root, hasConflict, blocked) {
  if (!isTelemetryEnabled()) return;
  try {
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
  } catch { /* swallow */ }
}

/**
 * Track feature adoption (legacy).
 */
export function trackFeature(root, featureName) {
  if (!isTelemetryEnabled()) return;
  try {
    const store = readTelemetryStore(root);
    if (!store.features[featureName]) {
      store.features[featureName] = { firstUsed: new Date().toISOString(), count: 0 };
    }
    store.features[featureName].count++;
    store.features[featureName].lastUsed = new Date().toISOString();
    store.updatedAt = new Date().toISOString();
    writeTelemetryStore(root, store);
  } catch { /* swallow */ }
}

/**
 * Track a session start (legacy).
 */
export function trackSession(root, toolName) {
  if (!isTelemetryEnabled()) return;
  try {
    const store = readTelemetryStore(root);
    store.sessions.total++;
    if (!store.sessions.tools[toolName]) store.sessions.tools[toolName] = 0;
    store.sessions.tools[toolName]++;
    store.updatedAt = new Date().toISOString();
    writeTelemetryStore(root, store);
  } catch { /* swallow */ }
}

/**
 * Get telemetry summary for dashboard display (legacy).
 */
export function getTelemetrySummary(root) {
  if (!isTelemetryEnabled()) {
    return {
      enabled: false,
      message:
        "Telemetry is disabled. Set SPECLOCK_TELEMETRY=true or run 'speclock telemetry on' to enable.",
    };
  }

  const store = readTelemetryStore(root);

  const topTools = Object.entries(store.toolUsage)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data }));

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, ...(store.daily[key] || { calls: 0, conflicts: 0 }) });
  }

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

/**
 * Flush legacy telemetry to a remote endpoint (if configured).
 * Kept for backward compatibility with code that calls it directly.
 */
export async function flushToRemote(root) {
  if (!isTelemetryEnabled()) return { sent: false, reason: "disabled" };

  const endpoint = process.env.SPECLOCK_TELEMETRY_ENDPOINT;
  if (!endpoint) return { sent: false, reason: "no endpoint configured" };

  const summary = getTelemetrySummary(root);
  if (!summary.enabled) return { sent: false, reason: "disabled" };

  const payload = {
    instanceId: summary.instanceId,
    version: getSpeclockVersion(),
    totalCalls: summary.totalCalls,
    avgResponseMs: summary.avgResponseMs,
    conflicts: summary.conflicts,
    sessions: summary.sessions,
    topTools: summary.topTools.map((t) => ({ name: t.name, count: t.count })),
    features: summary.features.map((f) => ({ name: f.name, count: f.count })),
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1000),
    });
    return { sent: true, status: response.status };
  } catch {
    return { sent: false, reason: "network error" };
  }
}

// ---------------------------------------------------------------------------
// GLOBAL OPT-IN CLI TELEMETRY (investor-requested)
// ---------------------------------------------------------------------------
//
// This layer is what the `speclock telemetry on|off|status|clear` commands
// operate on, and is what the CLI entrypoint feeds via recordCommand().
// It lives under the user's home directory so the decision persists across
// projects:
//
//   ~/.speclock/install-id         single-line random UUID, generated once
//   ~/.speclock/telemetry.json     { enabled: bool, decidedAt: iso, installedAt: iso }
//   ~/.speclock/telemetry.jsonl    append-only JSON-lines event log
//
// The default remote endpoint is the SpecLock Railway deploy. It can be
// overridden with SPECLOCK_TELEMETRY_ENDPOINT, or disabled entirely by
// setting SPECLOCK_TELEMETRY_ENDPOINT=off. When unreachable, events are
// still written locally so the data shape can be validated without a server.

export const TELEMETRY_DEFAULT_ENDPOINT =
  "https://speclock-mcp-production.up.railway.app/telemetry";

function homeDir() {
  try {
    return os.homedir();
  } catch {
    return process.env.HOME || process.env.USERPROFILE || ".";
  }
}

export function getTelemetryDir() {
  return path.join(homeDir(), ".speclock");
}

function ensureTelemetryDir() {
  const dir = getTelemetryDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch { /* swallow */ }
  return dir;
}

function configPath() {
  return path.join(getTelemetryDir(), "telemetry.json");
}

function eventsPath() {
  return path.join(getTelemetryDir(), "telemetry.jsonl");
}

function installIdPath() {
  return path.join(getTelemetryDir(), "install-id");
}

/**
 * Read the global telemetry config file. If missing, returns undecided state.
 */
export function readTelemetryConfig() {
  try {
    const p = configPath();
    if (!fs.existsSync(p)) return { enabled: null, decidedAt: null, installedAt: null };
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : null,
      decidedAt: parsed.decidedAt || null,
      installedAt: parsed.installedAt || null,
    };
  } catch {
    return { enabled: null, decidedAt: null, installedAt: null };
  }
}

/**
 * Persist the global telemetry config file. Always merges into any existing
 * fields (e.g. installedAt is written only once).
 */
export function writeTelemetryConfig(patch) {
  try {
    ensureTelemetryDir();
    const current = readTelemetryConfig();
    const next = { ...current, ...patch };
    if (!next.installedAt) next.installedAt = new Date().toISOString();
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
    return next;
  } catch {
    return null;
  }
}

/**
 * Ensures an install id exists and returns it. This is the ONLY stable
 * identifier we emit. It is a random UUID — never contains PII.
 */
export function getInstallId() {
  try {
    ensureTelemetryDir();
    const p = installIdPath();
    if (fs.existsSync(p)) {
      const id = fs.readFileSync(p, "utf-8").trim();
      if (id) return id;
    }
    const id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(p, id);
    // Bootstrap installedAt if we just created the id.
    const cfg = readTelemetryConfig();
    if (!cfg.installedAt) writeTelemetryConfig({ installedAt: new Date().toISOString() });
    return id;
  } catch {
    return "unknown";
  }
}

/**
 * Returns true if the user has opted in globally. Honours the SPECLOCK_TELEMETRY
 * env var as a strong override so CI and one-off runs can force-enable without
 * touching disk. SPECLOCK_TELEMETRY=0/false forces disabled.
 */
export function isTelemetryOptedIn() {
  try {
    const env = process.env.SPECLOCK_TELEMETRY;
    if (env === "1" || env === "true") return true;
    if (env === "0" || env === "false") return false;
    const cfg = readTelemetryConfig();
    return cfg.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Returns true when no decision has been made yet (no prompt shown, no env var).
 */
export function hasTelemetryDecision() {
  try {
    const env = process.env.SPECLOCK_TELEMETRY;
    if (env === "1" || env === "true" || env === "0" || env === "false") return true;
    const cfg = readTelemetryConfig();
    return cfg.enabled !== null;
  } catch {
    return false;
  }
}

/**
 * Opt in (persistent). Returns the updated config.
 */
export function enableTelemetry() {
  getInstallId();
  return writeTelemetryConfig({ enabled: true, decidedAt: new Date().toISOString() });
}

/**
 * Opt out (persistent). Returns the updated config.
 */
export function disableTelemetry() {
  return writeTelemetryConfig({ enabled: false, decidedAt: new Date().toISOString() });
}

/**
 * Clear the local event log. Does not change opt-in state.
 */
export function clearTelemetryLog() {
  try {
    const p = eventsPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { cleared: true };
  } catch {
    return { cleared: false };
  }
}

/**
 * Read the last N events from the local log (most recent last).
 */
export function readRecentEvents(limit = 10) {
  try {
    const p = eventsPath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const slice = lines.slice(-limit);
    return slice
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Count all events recorded in the local log.
 */
export function countTelemetryEvents() {
  try {
    const p = eventsPath();
    if (!fs.existsSync(p)) return 0;
    const raw = fs.readFileSync(p, "utf-8");
    return raw.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

// --- Context collection (anonymous, non-PII only) ---

function getSpeclockVersion() {
  try {
    // Resolve the package.json of the installed speclock module relative
    // to this file. Works both in the source tree and when installed via npm.
    const here = path.dirname(new URL(import.meta.url).pathname);
    // On win32, URL pathname starts with "/C:/..." — strip the leading slash.
    const normalised = process.platform === "win32" && here.startsWith("/")
      ? here.slice(1)
      : here;
    const pkgPath = path.resolve(normalised, "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function daysSinceInstall() {
  try {
    const cfg = readTelemetryConfig();
    if (!cfg.installedAt) return 0;
    const installed = new Date(cfg.installedAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - installed) / (24 * 60 * 60 * 1000)));
  } catch {
    return 0;
  }
}

function countLocksInProject(projectRoot) {
  try {
    const brainPath = path.join(projectRoot, ".speclock", "brain.json");
    if (!fs.existsSync(brainPath)) return 0;
    const brain = JSON.parse(fs.readFileSync(brainPath, "utf-8"));
    const items = brain && brain.specLock && Array.isArray(brain.specLock.items)
      ? brain.specLock.items
      : [];
    return items.filter((l) => l && l.active !== false).length;
  } catch {
    return 0;
  }
}

function countRuleFilesInProject(projectRoot) {
  // Keep the list in sync with guardian.js RULE_FILES (we duplicate it here
  // so telemetry has zero runtime dependency on guardian).
  const candidates = [
    ".cursorrules",
    ".cursor/rules/rules.mdc",
    "CLAUDE.md",
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ".windsurfrules",
    ".windsurf/rules/rules.md",
    "GEMINI.md",
    ".aider.conf.yml",
    "COPILOT.md",
    ".github/instructions.md",
  ];
  let count = 0;
  for (const rel of candidates) {
    try {
      const full = path.join(projectRoot, rel);
      if (fs.existsSync(full)) count++;
    } catch { /* swallow */ }
  }
  return count;
}

function getEnforcementModeForProject(projectRoot) {
  try {
    const brainPath = path.join(projectRoot, ".speclock", "brain.json");
    if (!fs.existsSync(brainPath)) return "unknown";
    const brain = JSON.parse(fs.readFileSync(brainPath, "utf-8"));
    const mode = brain && brain.enforcement && brain.enforcement.mode;
    if (mode === "hard") return "hard";
    if (mode === "advisory") return "warn";
    return "warn"; // default
  } catch {
    return "unknown";
  }
}

/**
 * Detect which supported MCP clients have SpecLock wired up. Returns an
 * array of client names (e.g. ["claude-code", "cursor"]). No file content
 * is read except to look for the substring "speclock" in a JSON/TOML blob.
 * Never reads from the project directory.
 */
function detectMcpClientsConfigured() {
  const home = homeDir();
  const platform = process.platform;
  const checks = [
    { name: "claude-code", p: path.join(home, ".claude", "mcp.json") },
    { name: "cursor", p: path.join(home, ".cursor", "mcp.json") },
    { name: "windsurf", p: path.join(home, ".codeium", "windsurf", "mcp_config.json") },
    { name: "codex", p: path.join(home, ".codex", "config.toml") },
  ];

  // Cline lives inside VS Code User settings.json.
  if (platform === "win32") {
    checks.push({
      name: "cline",
      p: path.join(
        process.env.APPDATA || path.join(home, "AppData", "Roaming"),
        "Code",
        "User",
        "settings.json"
      ),
    });
  } else if (platform === "darwin") {
    checks.push({
      name: "cline",
      p: path.join(home, "Library", "Application Support", "Code", "User", "settings.json"),
    });
  } else {
    checks.push({
      name: "cline",
      p: path.join(home, ".config", "Code", "User", "settings.json"),
    });
  }

  const found = [];
  for (const c of checks) {
    try {
      if (!fs.existsSync(c.p)) continue;
      const raw = fs.readFileSync(c.p, "utf-8");
      if (raw && raw.toLowerCase().includes("speclock")) {
        found.push(c.name);
      }
    } catch { /* swallow */ }
  }
  return found;
}

/**
 * Build the anonymous payload for a single command invocation.
 * Public so `telemetry status` can show exactly what would be sent.
 */
export function buildTelemetryEvent({
  command,
  exitCode,
  projectRoot = process.cwd(),
  extra = {},
} = {}) {
  return {
    installId: getInstallId(),
    version: getSpeclockVersion(),
    os: process.platform,
    nodeVersion: process.version,
    command: command || "unknown",
    exitCode: typeof exitCode === "number" ? exitCode : 0,
    enforcementMode: getEnforcementModeForProject(projectRoot),
    lockCount: countLocksInProject(projectRoot),
    ruleFilesFound: countRuleFilesInProject(projectRoot),
    mcpClientsConfigured: detectMcpClientsConfigured(),
    daysSinceInstall: daysSinceInstall(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Append an event to the local JSONL log.
 */
function appendEvent(event) {
  try {
    ensureTelemetryDir();
    fs.appendFileSync(eventsPath(), JSON.stringify(event) + "\n");
  } catch { /* swallow */ }
}

/**
 * Send an event to the remote endpoint with a 1-second timeout.
 * Silently swallows all errors. Returns a Promise that never rejects.
 */
async function sendEventRemote(event) {
  try {
    const raw = process.env.SPECLOCK_TELEMETRY_ENDPOINT;
    if (raw === "off" || raw === "none" || raw === "0") return;
    const endpoint = raw || TELEMETRY_DEFAULT_ENDPOINT;

    let signal;
    try {
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        signal = AbortSignal.timeout(1000);
      } else {
        const ctl = new AbortController();
        setTimeout(() => ctl.abort(), 1000).unref?.();
        signal = ctl.signal;
      }
    } catch { /* ignore — send without signal */ }

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal,
    });
  } catch { /* swallow every failure */ }
}

/**
 * Record a command invocation. Fire-and-forget: the caller is never blocked,
 * no error ever reaches them. Writes to local JSONL immediately so the data
 * shape can be validated without a running server, and also attempts a
 * best-effort remote send behind a 1-second timeout.
 *
 * Usage from the CLI entrypoint:
 *
 *     recordCommand("protect", 0);
 *
 * This function is safe to call from inside a `process.on('exit')` handler:
 * the local JSONL write happens synchronously so it completes before the
 * process terminates, while the remote HTTP send is scheduled via
 * setImmediate (which will no-op on exit, but that's fine — the local log
 * is the source of truth for validating the data shape).
 *
 * Safe to call even when telemetry is disabled — it will simply no-op.
 */
export function recordCommand(command, exitCode, opts = {}) {
  try {
    if (!isTelemetryOptedIn()) return;
    const event = buildTelemetryEvent({
      command,
      exitCode,
      projectRoot: opts.projectRoot || process.cwd(),
      extra: opts.extra || {},
    });
    // Synchronous local write — must complete even if called from an
    // 'exit' handler where microtasks/timers are no longer scheduled.
    try { appendEvent(event); } catch { /* swallow */ }
    // Best-effort remote send — fire-and-forget behind a 1s timeout.
    try {
      if (typeof setImmediate === "function") {
        setImmediate(() => { sendEventRemote(event); });
      } else {
        setTimeout(() => { sendEventRemote(event); }, 0);
      }
    } catch { /* swallow */ }
  } catch { /* swallow */ }
}

/**
 * Human-readable summary of the current opt-in state + last events.
 * Used by `speclock telemetry status`.
 */
export function getOptInTelemetryStatus({ eventLimit = 10 } = {}) {
  try {
    const cfg = readTelemetryConfig();
    const envOverride = process.env.SPECLOCK_TELEMETRY;
    const enabled = isTelemetryOptedIn();
    return {
      enabled,
      decided: hasTelemetryDecision(),
      decidedAt: cfg.decidedAt,
      installedAt: cfg.installedAt,
      installId: getInstallId(),
      configPath: configPath(),
      eventsPath: eventsPath(),
      envOverride: envOverride || null,
      endpoint:
        process.env.SPECLOCK_TELEMETRY_ENDPOINT === "off"
          ? null
          : process.env.SPECLOCK_TELEMETRY_ENDPOINT || TELEMETRY_DEFAULT_ENDPOINT,
      eventCount: countTelemetryEvents(),
      recentEvents: readRecentEvents(eventLimit),
      sampleEvent: buildTelemetryEvent({ command: "<sample>", exitCode: 0 }),
    };
  } catch {
    return {
      enabled: false,
      decided: false,
      decidedAt: null,
      installedAt: null,
      installId: "unknown",
      configPath: configPath(),
      eventsPath: eventsPath(),
      envOverride: null,
      endpoint: TELEMETRY_DEFAULT_ENDPOINT,
      eventCount: 0,
      recentEvents: [],
      sampleEvent: null,
    };
  }
}

/**
 * Prompts the user on stdin with a Y/N question. Resolves to true on "y"/"yes",
 * false otherwise. Defaults to false if stdin is not a TTY or an error occurs.
 */
export function promptTelemetryOptIn() {
  return new Promise((resolve) => {
    try {
      if (!process.stdin.isTTY) return resolve(false);
      process.stdout.write(`
Help improve SpecLock?
We collect anonymous usage data to understand which features matter.
We NEVER collect: file contents, commit messages, lock content, paths, names.
See: speclock telemetry status

Enable telemetry? [y/N]: `);
      let buf = "";
      const onData = (chunk) => {
        buf += chunk.toString();
        if (buf.includes("\n")) {
          process.stdin.removeListener("data", onData);
          process.stdin.pause();
          const answer = buf.trim().toLowerCase();
          resolve(answer === "y" || answer === "yes");
        }
      };
      process.stdin.resume();
      process.stdin.on("data", onData);
      // Safety timeout — never block forever.
      setTimeout(() => {
        try { process.stdin.removeListener("data", onData); } catch {}
        try { process.stdin.pause(); } catch {}
        resolve(false);
      }, 15000).unref?.();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Ensures a telemetry decision has been recorded. If none exists and we are
 * attached to a TTY, prompts the user. Defaults to OFF for any non-interactive
 * shell or on any error. Always persists the decision so we never prompt twice.
 * Resolves to the final opt-in boolean.
 */
export async function ensureTelemetryDecision() {
  try {
    if (hasTelemetryDecision()) return isTelemetryOptedIn();
    const answer = await promptTelemetryOptIn();
    if (answer) {
      enableTelemetry();
      console.log("Telemetry: ENABLED. Thank you! Run 'speclock telemetry off' to disable any time.");
      return true;
    } else {
      disableTelemetry();
      console.log("Telemetry: DISABLED. Run 'speclock telemetry on' to enable any time.");
      return false;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// USER-FACING USAGE STATS — surfaces the local telemetry.jsonl log back to
// the user via `speclock stats`. No network calls, no PII, purely local.
// ---------------------------------------------------------------------------

/**
 * Read ALL events from the local JSONL log (most recent last). Unlike
 * readRecentEvents() this does NOT cap the list — the caller is expected to
 * aggregate and then discard.
 */
export function readAllTelemetryEvents() {
  try {
    const p = eventsPath();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Build a plain-data aggregate of the user's local telemetry log. Always
 * safe to call — returns zero-filled fields when telemetry is disabled or
 * the log is missing. The CLI `stats` command renders this; tests assert
 * against the shape directly.
 *
 * @param {{ events?: Array, recentLimit?: number, now?: Date }} [opts]
 *   - events: pre-supplied events (for tests). Defaults to reading ~/.speclock/telemetry.jsonl.
 *   - recentLimit: how many recent events to include (default 10).
 *   - now: clock override for deterministic tests.
 */
export function buildUsageStats(opts = {}) {
  const events = Array.isArray(opts.events) ? opts.events : readAllTelemetryEvents();
  const recentLimit = typeof opts.recentLimit === "number" ? opts.recentLimit : 10;
  const now = opts.now instanceof Date ? opts.now : new Date();

  const cfg = readTelemetryConfig();
  const installId = getInstallId();

  // First install timestamp — prefer config, fall back to earliest event.
  let firstInstallIso = cfg.installedAt || null;
  if (!firstInstallIso && events.length > 0) {
    let earliest = null;
    for (const e of events) {
      const t = e && e.timestamp ? Date.parse(e.timestamp) : NaN;
      if (Number.isFinite(t) && (earliest === null || t < earliest)) earliest = t;
    }
    if (earliest !== null) firstInstallIso = new Date(earliest).toISOString();
  }

  // Days since first install.
  let daysActive = 0;
  if (firstInstallIso) {
    const t = Date.parse(firstInstallIso);
    if (Number.isFinite(t)) {
      daysActive = Math.max(0, Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000)));
    }
  }

  // Commands by type.
  const commandsByType = {};
  for (const e of events) {
    const cmd = (e && e.command) || "unknown";
    commandsByType[cmd] = (commandsByType[cmd] || 0) + 1;
  }

  // Recent events (most recent last).
  const recent = events.slice(-recentLimit);

  return {
    telemetryEnabled: isTelemetryOptedIn(),
    installId,
    firstInstallIso,
    daysActive,
    totalEvents: events.length,
    commandsByType,
    recentEvents: recent,
    eventsPath: eventsPath(),
    configPath: configPath(),
  };
}
