// ===================================================================
// SpecLock Compliance Export Test Suite
// Tests SOC 2, HIPAA, and CSV export formats.
// Run: node tests/compliance-export.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import { exportSOC2, exportHIPAA, exportCSV, exportCompliance } from "../src/core/compliance.js";
import { ensureInit, setGoal, addLock, addDecision, logChange } from "../src/core/engine.js";

// --- Test infrastructure ---
let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName, detail) {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    console.log(`  FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-compliance-"));
  return tmpDir;
}

function cleanupTemp(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

function setupProject(root) {
  ensureInit(root);
  setGoal(root, "Build HIPAA-compliant patient portal");
  addLock(root, "Never delete patient records", ["hipaa", "data"], "user");
  addLock(root, "Never expose PHI without encryption", ["hipaa", "security"], "user");
  addLock(root, "Never modify auth middleware", ["security"], "user");
  addDecision(root, "Use Supabase for patient data storage", ["database", "hipaa"], "user");
  addDecision(root, "Implement AES-256 for health record encryption", ["security"], "user");
  logChange(root, "Created patient data model", ["src/models/patient.js"]);
  logChange(root, "Added auth middleware", ["src/middleware/auth.js"]);
}

// =========================================================
// CATEGORY 1: SOC 2 Export
// =========================================================

console.log("\n--- Category 1: SOC 2 Export ---");

(() => {
  const root = createTempProject();
  try {
    setupProject(root);
    const report = exportSOC2(root);

    assert(report.report === "SOC 2 Type II — SpecLock Compliance Export", "SOC 2: correct report title");
    assert(typeof report.version === "string" && report.version.startsWith("2."), "SOC 2: version starts with 2.x");
    assert(typeof report.generatedAt === "string", "SOC 2: has generatedAt timestamp");

    // Project info
    assert(report.project.goal === "Build HIPAA-compliant patient portal", "SOC 2: goal included");
    assert(typeof report.project.name === "string", "SOC 2: project name included");

    // Audit chain
    assert(typeof report.auditChainIntegrity === "object", "SOC 2: audit chain section exists");
    assert(typeof report.auditChainIntegrity.valid === "boolean", "SOC 2: chain validity reported");
    assert(typeof report.auditChainIntegrity.totalEvents === "number", "SOC 2: total events reported");

    // Constraint management
    assert(report.constraintManagement.activeConstraints === 3, "SOC 2: 3 active constraints");
    assert(report.constraintManagement.changeHistory.length > 0, "SOC 2: constraint change history populated");

    // Decision audit trail
    assert(report.decisionAuditTrail.totalDecisions === 2, "SOC 2: 2 decisions");

    // Change management
    assert(report.changeManagement.totalEvents > 0, "SOC 2: events tracked");
    assert(typeof report.changeManagement.eventBreakdown === "object", "SOC 2: event breakdown by type");

    // Violations
    assert(typeof report.violations === "object", "SOC 2: violations section exists");
    assert(typeof report.violations.total === "number", "SOC 2: violation count reported");
  } finally {
    cleanupTemp(root);
  }
})();

// Test uninitalized project
(() => {
  const root = createTempProject();
  try {
    const report = exportSOC2(root);
    assert(report.error !== undefined, "SOC 2: uninitialized project returns error");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 2: HIPAA Export
// =========================================================

console.log("\n--- Category 2: HIPAA Export ---");

(() => {
  const root = createTempProject();
  try {
    setupProject(root);
    const report = exportHIPAA(root);

    assert(report.report === "HIPAA Compliance — SpecLock PHI Protection Report", "HIPAA: correct report title");

    // Safeguards
    assert(typeof report.safeguards === "object", "HIPAA: safeguards section exists");
    assert(typeof report.safeguards.technicalSafeguards === "object", "HIPAA: technical safeguards");
    assert(typeof report.safeguards.administrativeSafeguards === "object", "HIPAA: administrative safeguards");

    // Audit controls
    const audit = report.safeguards.technicalSafeguards.auditControls;
    assert(typeof audit.enabled === "boolean", "HIPAA: audit controls enabled reported");
    assert(typeof audit.status === "string", "HIPAA: audit status string");

    // Access control
    const access = report.safeguards.technicalSafeguards.accessControl;
    assert(typeof access.authEnabled === "boolean", "HIPAA: auth status reported");

    // Encryption
    const encryption = report.safeguards.technicalSafeguards.encryption;
    assert(typeof encryption.atRest === "boolean", "HIPAA: encryption status reported");

    // PHI constraints — should filter for patient/PHI-related
    const phiConstraints = report.phiProtection.constraints;
    assert(phiConstraints.length === 2, "HIPAA: 2 PHI-related constraints found", `found ${phiConstraints.length}`);
    assert(
      phiConstraints.some((c) => c.text.includes("patient records")),
      "HIPAA: patient records lock included"
    );
    assert(
      phiConstraints.some((c) => c.text.includes("PHI")),
      "HIPAA: PHI lock included"
    );

    // PHI decisions
    const phiDecisions = report.phiProtection.decisions;
    assert(phiDecisions.length >= 1, "HIPAA: PHI-related decisions found");

    // Audit trail
    assert(typeof report.auditTrail === "object", "HIPAA: audit trail section");
    assert(typeof report.auditTrail.integrity === "object", "HIPAA: chain integrity in audit trail");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 3: CSV Export
// =========================================================

console.log("\n--- Category 3: CSV Export ---");

(() => {
  const root = createTempProject();
  try {
    setupProject(root);
    const csv = exportCSV(root);

    assert(typeof csv === "string", "CSV: returns a string");

    const lines = csv.split("\n");
    assert(lines[0] === "timestamp,event_id,type,summary,files,hash", "CSV: correct header row");
    assert(lines.length > 2, "CSV: has data rows beyond header");

    // Check data row format
    const firstDataRow = lines[1];
    const columns = firstDataRow.match(/(".*?"|[^,]+)/g);
    assert(columns && columns.length === 6, "CSV: data rows have 6 columns");

    // Verify all event types appear
    assert(csv.includes("init"), "CSV: contains init event");
    assert(csv.includes("goal_updated"), "CSV: contains goal_updated event");
    assert(csv.includes("lock_added"), "CSV: contains lock_added event");
  } finally {
    cleanupTemp(root);
  }
})();

// Empty project CSV
(() => {
  const root = createTempProject();
  try {
    // Don't initialize — just check the edge case
    ensureInit(root);
    // exportCSV should work even with minimal events
    const csv = exportCSV(root);
    assert(typeof csv === "string", "CSV: works on minimal project");
    assert(csv.includes("timestamp,event_id,type,summary,files,hash"), "CSV: header present even with few events");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 4: Format Dispatcher
// =========================================================

console.log("\n--- Category 4: Format Dispatcher ---");

(() => {
  const root = createTempProject();
  try {
    setupProject(root);

    const soc2 = exportCompliance(root, "soc2");
    assert(soc2.format === "soc2", "Dispatcher: soc2 format");
    assert(typeof soc2.data === "object", "Dispatcher: soc2 returns object");

    const hipaa = exportCompliance(root, "hipaa");
    assert(hipaa.format === "hipaa", "Dispatcher: hipaa format");
    assert(typeof hipaa.data === "object", "Dispatcher: hipaa returns object");

    const csv = exportCompliance(root, "csv");
    assert(csv.format === "csv", "Dispatcher: csv format");
    assert(typeof csv.data === "string", "Dispatcher: csv returns string");

    const invalid = exportCompliance(root, "xml");
    assert(invalid.error !== undefined, "Dispatcher: invalid format returns error");
    assert(Array.isArray(invalid.supportedFormats), "Dispatcher: lists supported formats");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 5: Edge Cases
// =========================================================

console.log("\n--- Category 5: Edge Cases ---");

(() => {
  // Project with special characters in data
  const root = createTempProject();
  try {
    ensureInit(root);
    setGoal(root, 'Build "Sandeep\'s" app — unicode: éèê');
    addLock(root, 'Never delete "patient" data with quotes', [], "user");
    logChange(root, 'Fixed bug in "auth" module', ["src/auth.js"]);

    const soc2 = exportSOC2(root);
    assert(typeof soc2 === "object" && !soc2.error, "Edge: special characters don't break SOC 2");

    const csv = exportCSV(root);
    assert(typeof csv === "string", "Edge: special characters don't break CSV");
    // CSV should properly escape quotes
    assert(csv.includes('""'), "Edge: CSV escapes double quotes");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// SUMMARY
// =========================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`COMPLIANCE EXPORT TESTS: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
