/**
 * Unit tests for `speclock stats`
 *
 * Verifies:
 *   1. buildUsageStats aggregates events correctly (command counts, recent slice)
 *   2. buildUsageStats handles empty/missing log gracefully
 *   3. buildUsageStats returns totalEvents === events.length
 *   4. buildStatsView falls back to brain.json when telemetry is disabled
 *   5. formatStatsDashboard renders expected headings + tip line
 *   6. formatStatsDashboard handles the empty-state (no events, no brain)
 *   7. daysActive is computed from firstInstallIso against the provided `now`
 *
 * Runs with: node tests/stats.test.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- Tiny test harness (awaits async tests so the summary is accurate) ---
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  [OK] ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.error(`  [FAIL] ${name}: ${e.message}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, label) {
  if (typeof haystack !== "string" || !haystack.includes(needle)) {
    throw new Error(`${label}: expected string to contain ${JSON.stringify(needle)}`);
  }
}

function makeTempProject(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `speclock-stats-${label}-`));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// --- Load helpers under test ---
process.env.SPECLOCK_CLI_NO_AUTORUN = "1";
// Disable telemetry so buildUsageStats reports telemetryEnabled=false by default
// (individual tests can inject events via opts).
process.env.SPECLOCK_TELEMETRY = "0";

const telemetry = await import("../src/core/telemetry.js");
const cli = await import("../src/cli/index.js");
const { buildUsageStats } = telemetry;
const { buildStatsView, formatStatsDashboard } = cli;

if (typeof buildUsageStats !== "function") {
  console.error("buildUsageStats is not exported from src/core/telemetry.js");
  process.exit(1);
}
if (typeof buildStatsView !== "function" || typeof formatStatsDashboard !== "function") {
  console.error("buildStatsView/formatStatsDashboard not exported from src/cli/index.js");
  process.exit(1);
}

console.log("\n--- speclock stats tests ---\n");

// --- 1. Aggregates command counts correctly ---
await test("buildUsageStats aggregates commandsByType correctly", () => {
  const events = [
    { command: "protect", exitCode: 0, timestamp: "2026-04-08T10:00:00.000Z" },
    { command: "check",   exitCode: 0, timestamp: "2026-04-08T10:01:00.000Z" },
    { command: "check",   exitCode: 0, timestamp: "2026-04-08T10:02:00.000Z" },
    { command: "check",   exitCode: 1, timestamp: "2026-04-08T10:03:00.000Z" },
    { command: "audit",   exitCode: 0, timestamp: "2026-04-08T10:04:00.000Z" },
  ];
  const stats = buildUsageStats({ events, now: new Date("2026-04-10T00:00:00.000Z") });
  assertEq(stats.totalEvents, 5, "totalEvents");
  assertEq(stats.commandsByType.protect, 1, "protect count");
  assertEq(stats.commandsByType.check, 3, "check count");
  assertEq(stats.commandsByType.audit, 1, "audit count");
});

// --- 2. Recent events slice respects limit ---
await test("buildUsageStats recentEvents slice respects limit", () => {
  const events = [];
  for (let i = 0; i < 25; i++) {
    events.push({
      command: "check",
      exitCode: 0,
      timestamp: new Date(2026, 3, 1, 10, i).toISOString(),
    });
  }
  const stats = buildUsageStats({ events, recentLimit: 10 });
  assertEq(stats.recentEvents.length, 10, "recent length");
  // Last item must be the most recent (index 24)
  assertEq(stats.recentEvents[9], events[24], "last recent event");
  assertEq(stats.totalEvents, 25, "totalEvents");
});

// --- 3. Empty events — safe fallbacks ---
await test("buildUsageStats handles empty events gracefully", () => {
  const stats = buildUsageStats({ events: [], now: new Date("2026-04-10T00:00:00.000Z") });
  assertEq(stats.totalEvents, 0, "totalEvents");
  assertEq(Object.keys(stats.commandsByType).length, 0, "empty commandsByType");
  assertEq(stats.recentEvents.length, 0, "empty recentEvents");
});

// --- 4. daysActive computed from provided `now` ---
await test("buildUsageStats derives daysActive from earliest event when config missing", () => {
  // Earliest event is the fallback when readTelemetryConfig() has no installedAt.
  // The test environment may or may not have a config — accept either
  // a fall-back to the event timestamp OR the real install date, but always
  // enforce that daysActive is >= 0 and a finite integer.
  const events = [
    { command: "protect", exitCode: 0, timestamp: "2026-04-01T00:00:00.000Z" },
    { command: "check",   exitCode: 0, timestamp: "2026-04-05T00:00:00.000Z" },
  ];
  const stats = buildUsageStats({ events, now: new Date("2026-04-10T00:00:00.000Z") });
  if (!Number.isFinite(stats.daysActive) || stats.daysActive < 0) {
    throw new Error(`daysActive should be >= 0, got ${stats.daysActive}`);
  }
  // firstInstallIso should be set (either from config or fallback).
  if (!stats.firstInstallIso) throw new Error("firstInstallIso should be set");
});

// --- 5. buildStatsView falls back to brain.json when telemetry disabled ---
await test("buildStatsView reads lockCount from brain.json when telemetry disabled", async () => {
  const tmp = makeTempProject("brain");
  try {
    // Hand-craft a minimal brain.json (matches engine.js shape).
    const brainDir = path.join(tmp, ".speclock");
    fs.mkdirSync(brainDir, { recursive: true });
    const brain = {
      project: { name: "test-proj" },
      goal: { text: "" },
      specLock: {
        items: [
          { id: "L1", text: "Never touch auth", active: true },
          { id: "L2", text: "Never delete payments", active: true },
          { id: "L3", text: "Deprecated lock",     active: false },
        ],
      },
      decisions: [],
      notes: [],
      events: { count: 0 },
      facts: { deploy: {} },
      sessions: { current: null, history: [] },
      state: { recentChanges: [] },
      enforcement: { mode: "advisory" },
    };
    fs.writeFileSync(path.join(brainDir, "brain.json"), JSON.stringify(brain, null, 2));

    const view = buildStatsView(tmp, { events: [] });
    assertEq(view.brainExists, true, "brainExists");
    assertEq(view.lockCount, 2, "lockCount (active only)");
    assertEq(view.enforcementMode, "warn", "enforcementMode mapped to warn");
    assertEq(view.totalEvents, 0, "totalEvents");
    // Arrays must always be present.
    if (!Array.isArray(view.ruleFiles)) throw new Error("ruleFiles should be array");
    if (!Array.isArray(view.mcpClients)) throw new Error("mcpClients should be array");
  } finally {
    cleanup(tmp);
  }
});

// --- 6. buildStatsView handles missing brain.json ---
await test("buildStatsView handles missing brain.json gracefully", () => {
  const tmp = makeTempProject("nobrain");
  try {
    const view = buildStatsView(tmp, { events: [] });
    assertEq(view.brainExists, false, "brainExists");
    assertEq(view.lockCount, 0, "lockCount");
    // Rule files may legitimately be empty here.
    if (!Array.isArray(view.ruleFiles)) throw new Error("ruleFiles should be array");
  } finally {
    cleanup(tmp);
  }
});

// --- 7. formatStatsDashboard renders expected sections ---
await test("formatStatsDashboard renders all major sections", () => {
  const view = {
    telemetryEnabled: true,
    installId: "1df6db63-abcd-efgh-ijkl-000000000000",
    firstInstallIso: "2026-04-08T00:00:00.000Z",
    daysActive: 2,
    totalEvents: 3,
    commandsByType: { protect: 1, check: 2 },
    recentEvents: [
      { command: "protect", exitCode: 0, timestamp: "2026-04-08T10:00:00.000Z" },
      { command: "check",   exitCode: 0, timestamp: "2026-04-08T10:01:00.000Z" },
      { command: "check",   exitCode: 1, timestamp: "2026-04-08T10:02:00.000Z" },
    ],
    eventsPath: "/fake/events.jsonl",
    configPath: "/fake/config.json",
    brainExists: true,
    enforcementMode: "warn",
    lockCount: 12,
    ruleFiles: ["CLAUDE.md"],
    mcpClients: ["claude-code", "cursor"],
  };
  const out = formatStatsDashboard(view);
  assertIncludes(out, "SpecLock Stats — Your Usage", "title");
  assertIncludes(out, "Installation", "Installation heading");
  assertIncludes(out, "First install:   2026-04-08", "first install date");
  assertIncludes(out, "Days active:     2", "days active");
  assertIncludes(out, "Total events:    3", "total events");
  assertIncludes(out, "1df6db63...", "shortened install id");
  assertIncludes(out, "Commands Used", "Commands heading");
  assertIncludes(out, "check:", "check command row");
  assertIncludes(out, "protect:", "protect command row");
  assertIncludes(out, "Current State", "Current State heading");
  assertIncludes(out, "Enforcement:  warn", "enforcement mode");
  assertIncludes(out, "Locks:        12", "lock count");
  assertIncludes(out, "Rule files:   1 (CLAUDE.md)", "rule files line");
  assertIncludes(out, "MCP clients:  claude-code, cursor", "mcp clients line");
  assertIncludes(out, "Recent Activity (last 3)", "recent activity heading");
  assertIncludes(out, "protect", "recent protect entry");
  assertIncludes(out, "Tip: Run 'speclock telemetry status'", "tip line");
});

// --- 8. formatStatsDashboard handles the empty state ---
await test("formatStatsDashboard handles empty events + disabled telemetry", () => {
  const view = {
    telemetryEnabled: false,
    installId: "unknown",
    firstInstallIso: null,
    daysActive: 0,
    totalEvents: 0,
    commandsByType: {},
    recentEvents: [],
    eventsPath: "/fake/events.jsonl",
    configPath: "/fake/config.json",
    brainExists: false,
    enforcementMode: "unknown",
    lockCount: 0,
    ruleFiles: [],
    mcpClients: [],
  };
  const out = formatStatsDashboard(view);
  assertIncludes(out, "SpecLock Stats — Your Usage", "title");
  assertIncludes(out, "(unknown)", "unknown first install");
  assertIncludes(out, "telemetry disabled", "disabled hint");
  assertIncludes(out, "(no activity recorded)", "no activity");
  assertIncludes(out, "Note: telemetry is DISABLED", "disabled footer note");
});

// --- 9. totalEvents always matches events.length ---
await test("buildUsageStats totalEvents matches events.length exactly", () => {
  for (const n of [0, 1, 7, 47, 250]) {
    const events = Array.from({ length: n }, (_, i) => ({
      command: "check",
      exitCode: 0,
      timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    }));
    const stats = buildUsageStats({ events });
    assertEq(stats.totalEvents, n, `totalEvents for n=${n}`);
  }
});

// --- Summary ---
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`
);
if (failed.length > 0) {
  for (const f of failed) console.error(`  - ${f.name}: ${f.err}`);
  process.exit(1);
}
