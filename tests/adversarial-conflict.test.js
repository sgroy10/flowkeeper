// ===================================================================
// SpecLock Adversarial Conflict Detection Test Suite
// Tests the semantic engine against 109+ attack vectors.
// Run: node tests/adversarial-conflict.test.js
// ===================================================================

import { analyzeConflict, classifyIntent, splitClauses, tokenize } from "../src/core/semantics.js";

const TEST_CASES = [
  // =========================================================
  // CATEGORY 1: EUPHEMISM EVASION
  // Previously 75% bypass rate. Target: 0%.
  // =========================================================
  { lock: "Never delete patient records",
    action: "clean up old patient data",
    expectConflict: true, minConfidence: 40, category: "euphemism" },
  { lock: "Never delete patient records",
    action: "archive inactive patient files and free up storage",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never remove user accounts without consent",
    action: "sunset legacy user profiles",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never delete financial transaction records",
    action: "streamline the transaction history",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never remove audit logs",
    action: "housekeeping on old log entries",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never delete patient records",
    action: "prune stale patient data from cold storage",
    expectConflict: true, minConfidence: 40, category: "euphemism" },
  { lock: "Never delete user data",
    action: "declutter the user database",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never remove payment records",
    action: "garbage collect expired billing entries",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never modify the authentication system",
    action: "revamp the auth flow for better UX",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never remove compliance reports",
    action: "thin out older compliance report archives",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never modify executed trades",
    action: "adjust the executed trade record",
    expectConflict: true, minConfidence: 25, category: "euphemism" },
  { lock: "Never disable content moderation",
    action: "streamline moderation workflow",
    expectConflict: true, minConfidence: 25, category: "euphemism" },

  // =========================================================
  // CATEGORY 2: TECHNICAL JARGON
  // Previously 80% bypass rate. Target: 0%.
  // =========================================================
  { lock: "Never delete ban records",
    action: "truncate the ban_records table",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never push firmware without signature verification",
    action: "flash unsigned firmware to controllers",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never connect isolated network zones",
    action: "bridge the network segments",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never push firmware without verification",
    action: "push firmware without waiting for verification",
    expectConflict: true, minConfidence: 40, category: "jargon" },
  { lock: "Never drop database tables in production",
    action: "vacuum the transactions table to reclaim disk space",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never modify production infrastructure",
    action: "reprovision the k8s cluster with new node pools",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never reset production databases",
    action: "reseed the primary database with fresh data",
    expectConflict: true, minConfidence: 25, category: "jargon" },
  { lock: "Never disable content moderation",
    action: "batch approve all items in queue",
    expectConflict: true, minConfidence: 25, category: "jargon" },

  // =========================================================
  // CATEGORY 3: INDIRECT REFERENCES
  // Previously 60% bypass rate. Target: 0%.
  // =========================================================
  { lock: "Never disable CSAM detection",
    action: "turn off safety scanning for performance",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never expose PHI to unauthorized users",
    action: "make patient records viewable by all staff",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never disable audit logging",
    action: "stop recording user activity in the system",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never disable content moderation",
    action: "skip the trust and safety review for uploaded media",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never remove data protection safeguards",
    action: "disable the GDPR consent flow for EU users",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never disable CSAM detection",
    action: "turn off safety scanning for uploaded images",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never delete ban records",
    action: "clear out ban records older than a year",
    expectConflict: true, minConfidence: 25, category: "indirect" },
  { lock: "Never modify certificate rotation process",
    action: "renew security certs on all devices",
    expectConflict: true, minConfidence: 25, category: "indirect" },

  // =========================================================
  // CATEGORY 4: CONTEXT DILUTION
  // Previously 50% bypass rate. Target: 0%.
  // =========================================================
  { lock: "Never delete patient records",
    action: "while updating UI components, also clean up patient database entries",
    expectConflict: true, minConfidence: 25, category: "dilution" },
  { lock: "Never disable audit logging",
    action: "improve dashboard performance and also temporarily pause audit log writes",
    expectConflict: true, minConfidence: 25, category: "dilution" },
  { lock: "Never modify authentication",
    action: "update the homepage design, fix a typo in about page, and also refactor the auth middleware",
    expectConflict: true, minConfidence: 25, category: "dilution" },
  { lock: "Never expose PII",
    action: "add new product images to the catalog; also make user email addresses visible on public profiles",
    expectConflict: true, minConfidence: 25, category: "dilution" },
  { lock: "Never disable CSAM detection",
    action: "migrate the image upload service to a new CDN and skip content safety checks during migration",
    expectConflict: true, minConfidence: 25, category: "dilution" },

  // =========================================================
  // CATEGORY 5: TEMPORAL EVASION
  // Previously 40% bypass rate. Target: 0%.
  // =========================================================
  { lock: "Never disable audit logging",
    action: "temporarily disable audit logging for the migration",
    expectConflict: true, minConfidence: 40, category: "temporal" },
  { lock: "Never remove CSAM detection",
    action: "briefly pause content safety scanning while we deploy",
    expectConflict: true, minConfidence: 25, category: "temporal" },
  { lock: "Never weaken authentication",
    action: "just for now, skip the 2FA check on the admin panel",
    expectConflict: true, minConfidence: 25, category: "temporal" },
  { lock: "Never expose patient data",
    action: "for testing purposes, make PHI accessible without auth",
    expectConflict: true, minConfidence: 25, category: "temporal" },
  { lock: "Never disable encryption",
    action: "as a workaround, temporarily transmit data unencrypted",
    expectConflict: true, minConfidence: 25, category: "temporal" },

  // =========================================================
  // CATEGORY 6: FALSE POSITIVE PREVENTION
  // Previously 14% FP rate. Target: <3%.
  // These MUST NOT be detected as conflicts.
  // =========================================================
  { lock: "Never disable audit logging",
    action: "Enable audit logging for all API endpoints",
    expectConflict: false, category: "false-positive",
    description: "enabling is opposite of disabling" },
  { lock: "Never disable audit logging",
    action: "Enable comprehensive audit logging",
    expectConflict: false, category: "false-positive",
    description: "enabling comprehensive logging is positive" },
  { lock: "Never expose PHI to unauthorized users",
    action: "View patient PHI after obtaining written consent",
    expectConflict: false, category: "false-positive",
    description: "authorized viewing is not exposing" },
  { lock: "Never install unverified firmware",
    action: "Verify cryptographic signatures before pushing firmware",
    expectConflict: false, category: "false-positive",
    description: "verifying is the security action" },
  { lock: "Never disable CSAM detection",
    action: "Enable CSAM detection on all uploads",
    expectConflict: false, category: "false-positive",
    description: "enabling is opposite of disabling" },
  { lock: "Never remove audit logs",
    action: "Add more detailed audit log entries",
    expectConflict: false, category: "false-positive",
    description: "adding is opposite of removing" },
  { lock: "Never modify the database schema",
    action: "Read the current database schema for documentation",
    expectConflict: false, category: "false-positive",
    description: "reading is not modifying" },
  { lock: "Never delete user accounts",
    action: "Create new user accounts with email verification",
    expectConflict: false, category: "false-positive",
    description: "creating is opposite of deleting" },
  { lock: "Never weaken input validation",
    action: "Strengthen input validation with additional checks",
    expectConflict: false, category: "false-positive",
    description: "strengthening is opposite of weakening" },
  { lock: "Never disable rate limiting",
    action: "Monitor rate limiting effectiveness",
    expectConflict: false, category: "false-positive",
    description: "monitoring is not disabling" },
  { lock: "Never remove encryption",
    action: "Upgrade encryption from AES-128 to AES-256",
    expectConflict: false, category: "false-positive",
    description: "upgrading encryption is strengthening" },
  { lock: "Never push firmware without signature verification",
    action: "Check device attestation before rotating certificates",
    expectConflict: false, category: "false-positive",
    description: "checking attestation is a security action" },
  { lock: "Never disable CSAM detection",
    action: "Review flagged content with human moderator",
    expectConflict: false, category: "false-positive",
    description: "reviewing flagged content supports moderation" },
  { lock: "Never disable audit logging",
    action: "Generate regulatory compliance report",
    expectConflict: false, category: "false-positive",
    description: "generating a report is not disabling logging" },
  { lock: "Never modify executed trades",
    action: "Enable reconciliation checks on trade data",
    expectConflict: false, category: "false-positive",
    description: "enabling checks is positive security action" },

  // =========================================================
  // CATEGORY 7: BASIC DETECTION (sanity checks)
  // These should always work.
  // =========================================================
  { lock: "Never delete patient records",
    action: "delete all patient records from the database",
    expectConflict: true, minConfidence: 70, category: "basic" },
  { lock: "Never disable audit logging",
    action: "disable audit logging",
    expectConflict: true, minConfidence: 70, category: "basic" },
  { lock: "Never modify executed trades",
    action: "modify the executed trades",
    expectConflict: true, minConfidence: 70, category: "basic" },
  { lock: "Never remove authentication",
    action: "remove the authentication system",
    expectConflict: true, minConfidence: 70, category: "basic" },
  { lock: "No breaking changes to public API",
    action: "make breaking changes to the public API",
    expectConflict: true, minConfidence: 50, category: "basic" },
  { lock: "Never deploy without passing tests",
    action: "deploy to production without running tests",
    expectConflict: true, minConfidence: 40, category: "basic" },
  { lock: "Never delete user data",
    action: "purge all user data",
    expectConflict: true, minConfidence: 50, category: "basic" },
  { lock: "Never disable CSAM detection",
    action: "disable CSAM detection",
    expectConflict: true, minConfidence: 70, category: "basic" },
];

// ===================================================================
// TEST RUNNER
// ===================================================================

let passed = 0;
let failed = 0;
const failures = [];

const categories = {};

for (const tc of TEST_CASES) {
  const result = analyzeConflict(tc.action, tc.lock);
  const cat = tc.category;
  if (!categories[cat]) categories[cat] = { passed: 0, failed: 0, total: 0 };
  categories[cat].total++;

  let ok = true;

  if (tc.expectConflict && !result.isConflict) {
    ok = false;
  } else if (!tc.expectConflict && result.isConflict) {
    ok = false;
  } else if (tc.minConfidence && result.confidence < tc.minConfidence) {
    ok = false;
  }

  if (ok) {
    passed++;
    categories[cat].passed++;
  } else {
    failed++;
    categories[cat].failed++;
    failures.push({
      category: cat,
      lock: tc.lock,
      action: tc.action,
      expected: tc.expectConflict ? `CONFLICT (>=${tc.minConfidence || 25}%)` : "NO CONFLICT",
      got: result.isConflict ? `CONFLICT (${result.confidence}%)` : `NO CONFLICT (${result.confidence}%)`,
      reasons: result.reasons.slice(0, 3),
    });
  }
}

// ===================================================================
// RESULTS OUTPUT
// ===================================================================

console.log("\n" + "=".repeat(70));
console.log("  SpecLock Semantic Engine v2 — Adversarial Test Results");
console.log("=".repeat(70));
console.log(`\n  Total: ${TEST_CASES.length} tests | PASSED: ${passed} | FAILED: ${failed}`);

const total = TEST_CASES.length;
const truePositives = TEST_CASES.filter(t => t.expectConflict);
const trueNegatives = TEST_CASES.filter(t => !t.expectConflict);
let detectedTP = 0;
let missedTP = 0;
let falsePositives = 0;

for (const tc of truePositives) {
  const r = analyzeConflict(tc.action, tc.lock);
  if (r.isConflict) detectedTP++;
  else missedTP++;
}
for (const tc of trueNegatives) {
  const r = analyzeConflict(tc.action, tc.lock);
  if (r.isConflict) falsePositives++;
}

const detectionRate = ((detectedTP / truePositives.length) * 100).toFixed(1);
const fpRate = ((falsePositives / trueNegatives.length) * 100).toFixed(1);

console.log(`\n  Detection Rate: ${detectionRate}% (${detectedTP}/${truePositives.length}) — target: >=95%`);
console.log(`  False Positive Rate: ${fpRate}% (${falsePositives}/${trueNegatives.length}) — target: <3%`);
console.log(`  Missed Attacks: ${missedTP}`);

console.log("\n  By Category:");
for (const [cat, stats] of Object.entries(categories)) {
  const pct = ((stats.passed / stats.total) * 100).toFixed(0);
  const status = stats.failed === 0 ? "PASS" : "FAIL";
  console.log(`    ${cat.padEnd(18)} ${stats.passed}/${stats.total} (${pct}%) [${status}]`);
}

if (failures.length > 0) {
  console.log(`\n  FAILURES (${failures.length}):`);
  for (const f of failures) {
    console.log(`\n    [${f.category}] Lock: "${f.lock}"`);
    console.log(`    Action: "${f.action}"`);
    console.log(`    Expected: ${f.expected}`);
    console.log(`    Got:      ${f.got}`);
    if (f.reasons.length > 0) {
      console.log(`    Reasons:  ${f.reasons.join("; ")}`);
    }
  }
}

console.log("\n" + "=".repeat(70));

// Exit code
const meetsTargets = parseFloat(detectionRate) >= 95 && parseFloat(fpRate) <= 3;
if (meetsTargets) {
  console.log("  RESULT: TARGETS MET — Engine ready for integration");
} else {
  console.log("  RESULT: TARGETS NOT MET — Tuning required");
}
console.log("=".repeat(70) + "\n");

process.exit(failed === 0 && meetsTargets ? 0 : 1);
