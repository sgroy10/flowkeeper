/**
 * Unit tests for "speclock init --from <framework>"
 *
 * Verifies:
 *   1. Each framework name creates a CLAUDE.md with the correct content
 *   2. Invalid framework names are rejected
 *   3. The rule pack content is non-empty and contains rules
 *   4. Locks are correctly extracted from the generated CLAUDE.md
 *   5. "list" returns framework metadata without writing anything
 *   6. Existing CLAUDE.md is appended to, not overwritten
 *
 * Runs with: node tests/init-from.test.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// --- Tiny test harness ---
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  [OK] ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.error(`  [FAIL] ${name}: ${e.message}`);
  }
}

function makeTempProject(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `speclock-init-from-${label}-`));
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// --- Import the helpers under test ---
// Prevent src/cli/index.js from auto-running main() when imported
process.env.SPECLOCK_CLI_NO_AUTORUN = "1";
const cli = await import("../src/cli/index.js");
const { loadRulePack, initFromRulePack } = cli;

if (typeof loadRulePack !== "function") {
  console.error("loadRulePack is not exported from src/cli/index.js");
  process.exit(1);
}
if (typeof initFromRulePack !== "function") {
  console.error("initFromRulePack is not exported from src/cli/index.js");
  process.exit(1);
}

const FRAMEWORKS = ["nextjs", "fastapi", "rails", "react", "python", "node"];

// --- 1. Rule pack files exist on disk ---
test("rule pack files exist for every framework", () => {
  const dir = path.join(repoRoot, "src", "templates", "rule-packs");
  for (const fw of FRAMEWORKS) {
    const p = path.join(dir, `${fw}.md`);
    if (!fs.existsSync(p)) throw new Error(`missing rule pack: ${p}`);
  }
});

// --- 2. loadRulePack returns non-empty content for every framework ---
test("loadRulePack returns non-empty content for every framework", () => {
  for (const fw of FRAMEWORKS) {
    const r = loadRulePack(fw);
    if (!r.ok) throw new Error(`${fw}: ${r.error}`);
    if (!r.content || r.content.trim().length < 100) {
      throw new Error(`${fw}: content too short`);
    }
    if (r.ruleCount < 10) {
      throw new Error(`${fw}: expected >=10 rules, got ${r.ruleCount}`);
    }
  }
});

// --- 3. Invalid framework names rejected ---
test("loadRulePack rejects unknown framework", () => {
  const r = loadRulePack("not-a-framework");
  if (r.ok) throw new Error("expected failure for unknown framework");
  if (!/Unknown framework/.test(r.error)) {
    throw new Error(`unexpected error message: ${r.error}`);
  }
});

test("initFromRulePack rejects unknown framework", () => {
  const tmp = makeTempProject("bad");
  try {
    const r = initFromRulePack(tmp, "not-a-framework");
    if (r.ok) throw new Error("expected failure");
    if (!r.error || !/Unknown framework/.test(r.error)) {
      throw new Error(`unexpected error: ${r.error}`);
    }
    // CLAUDE.md should NOT have been created
    if (fs.existsSync(path.join(tmp, "CLAUDE.md"))) {
      throw new Error("CLAUDE.md was created for invalid framework");
    }
  } finally {
    cleanup(tmp);
  }
});

// --- 4. initFromRulePack writes CLAUDE.md with framework-specific content ---
test("initFromRulePack creates CLAUDE.md with correct content for every framework", () => {
  for (const fw of FRAMEWORKS) {
    const tmp = makeTempProject(fw);
    try {
      const r = initFromRulePack(tmp, fw);
      if (!r.ok) throw new Error(`${fw}: ${r.error}`);
      if (r.appended) throw new Error(`${fw}: unexpected append on fresh dir`);

      const claudePath = path.join(tmp, "CLAUDE.md");
      if (!fs.existsSync(claudePath)) {
        throw new Error(`${fw}: CLAUDE.md not created`);
      }
      const written = fs.readFileSync(claudePath, "utf-8");
      if (written.trim().length < 100) {
        throw new Error(`${fw}: CLAUDE.md too short`);
      }
      if (!/## Rules/i.test(written)) {
        throw new Error(`${fw}: missing Rules section`);
      }
      // Rule count must be >= 10
      if (r.ruleCount < 10) {
        throw new Error(`${fw}: expected >=10 rules, got ${r.ruleCount}`);
      }
      // displayName must exist
      if (!r.displayName) throw new Error(`${fw}: missing displayName`);
    } finally {
      cleanup(tmp);
    }
  }
});

// --- 5. "list" returns metadata without writing files ---
test("initFromRulePack list does not write any files", () => {
  const tmp = makeTempProject("list");
  try {
    // Silence the console.log during the list print
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = initFromRulePack(tmp, "list");
      if (!r.listed) throw new Error("expected listed=true");
    } finally {
      console.log = origLog;
    }
    if (fs.existsSync(path.join(tmp, "CLAUDE.md"))) {
      throw new Error("CLAUDE.md created during list");
    }
  } finally {
    cleanup(tmp);
  }
});

// --- 6. Existing CLAUDE.md is appended, not overwritten ---
test("existing CLAUDE.md is appended, not overwritten", () => {
  const tmp = makeTempProject("append");
  try {
    const claudePath = path.join(tmp, "CLAUDE.md");
    const sentinel = "# My Custom Rules\n\n- Keep existing content intact\n";
    fs.writeFileSync(claudePath, sentinel);

    // Silence the append warning
    const origLog = console.log;
    console.log = () => {};
    let r;
    try {
      r = initFromRulePack(tmp, "nextjs");
    } finally {
      console.log = origLog;
    }
    if (!r.ok) throw new Error(r.error);
    if (!r.appended) throw new Error("expected appended=true");

    const written = fs.readFileSync(claudePath, "utf-8");
    if (!written.includes(sentinel.trim())) {
      throw new Error("original CLAUDE.md content was lost");
    }
    if (!/Next\.js Rule Pack/i.test(written)) {
      throw new Error("Next.js rule pack content not appended");
    }
  } finally {
    cleanup(tmp);
  }
});

// --- 7. Locks extract correctly from the generated CLAUDE.md ---
test("extractConstraints finds locks in every generated CLAUDE.md", async () => {
  const guardian = await import("../src/core/guardian.js");
  for (const fw of FRAMEWORKS) {
    const tmp = makeTempProject(`extract-${fw}`);
    try {
      const r = initFromRulePack(tmp, fw);
      if (!r.ok) throw new Error(`${fw}: ${r.error}`);
      const content = fs.readFileSync(path.join(tmp, "CLAUDE.md"), "utf-8");
      const extracted = guardian.extractConstraints(content, "CLAUDE.md");
      if (!extracted.locks || extracted.locks.length < 10) {
        throw new Error(
          `${fw}: expected >=10 extracted locks, got ${extracted.locks?.length ?? 0}`
        );
      }
      // Sanity-check the first lock has meaningful text
      const first = extracted.locks[0];
      if (!first.text || first.text.length < 10) {
        throw new Error(`${fw}: first lock has no/short text`);
      }
    } finally {
      cleanup(tmp);
    }
  }
});

// --- Summary ---
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
