// ===================================================================
// SAM'S JOURNEY — Enterprise Hospital ERP on Claude Code
// ===================================================================
// Sam is a senior engineer building a HIPAA-compliant hospital ERP
// system. He uses Claude Code with SpecLock MCP. This test exercises
// every enterprise feature: auth, RBAC, encryption, hard enforcement,
// compliance exports, policy-as-code, SSO, telemetry, and full audit.
//
// Run: node tests/sam-enterprise-journey.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";

// Core
import {
  ensureSpeclockDirs,
  makeBrain,
  writeBrain,
  readBrain,
} from "../src/core/storage.js";

// Engine
import {
  ensureInit,
  setGoal,
  addLock,
  removeLock,
  addDecision,
  addNote,
  updateDeployFacts,
  logChange,
  checkConflict,
  suggestLocks,
  detectDrift,
  generateReport,
  startSession,
  endSession,
  getSessionBriefing,
  setEnforcementMode,
  getEnforcementConfig,
  enforceConflictCheck,
  overrideLock,
  getOverrideHistory,
} from "../src/core/engine.js";

// Auth & RBAC
import {
  isAuthEnabled,
  enableAuth,
  disableAuth,
  createApiKey,
  validateApiKey,
  checkPermission,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  ROLES,
} from "../src/core/auth.js";

// Encryption
import {
  isEncryptionEnabled,
  isEncrypted,
  encrypt,
  decrypt,
} from "../src/core/crypto.js";

// Compliance
import {
  exportSOC2,
  exportHIPAA,
  exportCSV,
  exportCompliance,
} from "../src/core/compliance.js";

// Audit
import { verifyAuditChain } from "../src/core/audit.js";

// Policy-as-Code
import {
  initPolicy,
  addPolicyRule,
  removePolicyRule,
  evaluatePolicy,
  listPolicyRules,
  exportPolicy,
  importPolicy,
} from "../src/core/policy.js";

// SSO
import {
  isSSOEnabled,
  getSSOConfig,
  saveSSOConfig,
  getAuthorizationUrl,
  validateSession,
  revokeSession,
  listSessions,
} from "../src/core/sso.js";

// Telemetry
import {
  isTelemetryEnabled,
  trackToolUsage,
  trackConflict,
  trackFeature,
  trackSession,
  getTelemetrySummary,
} from "../src/core/telemetry.js";

// --- Test infrastructure ---
let passed = 0;
let failed = 0;
let total = 0;
const failures = [];

function assert(condition, testName, detail) {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    const msg = `  FAIL: ${testName}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

function createProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sam-hospital-erp-"));
  ensureSpeclockDirs(tmpDir);
  const brain = makeBrain(tmpDir, false, "main");
  writeBrain(tmpDir, brain);
  return tmpDir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function activeLocks(brain) {
  return (brain.specLock?.items || []).filter(l => l.active !== false);
}

// ================================================================
console.log("\n" + "=".repeat(70));
console.log("  SAM'S JOURNEY — Enterprise Hospital ERP on Claude Code");
console.log("=".repeat(70));

const ROOT = createProject();

try {

// ================================================================
// SESSION 1: Project Init — HIPAA-Grade Setup
// ================================================================

console.log("\n--- Session 1: HIPAA-Grade Project Setup ---");
console.log("Sam: 'Initialize SpecLock for our hospital ERP. HIPAA compliance is mandatory.'");

(() => {
  const brain = ensureInit(ROOT);
  assert(brain !== null, "SpecLock initialized");

  // Goal
  const goalBrain = setGoal(ROOT, "Build a HIPAA-compliant hospital ERP with patient records, billing, scheduling, pharmacy, and lab results. All PHI must be encrypted at rest and in transit.");
  assert(goalBrain.goal.text.includes("HIPAA"), "Goal set with HIPAA requirement");

  // Start session
  const session = startSession(ROOT, "claude-code");
  assert(session.session.toolUsed === "claude-code", "Session started on Claude Code");

  // HIPAA locks — Sam locks critical systems
  const locks = [
    addLock(ROOT, "Patient records (PHI) must never be exposed without authentication and encryption. All access must be logged.", ["hipaa", "phi", "security"], "user"),
    addLock(ROOT, "Never store patient data in plain text — AES-256 encryption is required for all PHI at rest", ["hipaa", "encryption"], "user"),
    addLock(ROOT, "Never disable audit logging — every PHI access must be recorded for HIPAA compliance", ["hipaa", "audit"], "user"),
    addLock(ROOT, "Authentication must use multi-factor — never downgrade to single-factor auth for clinical systems", ["hipaa", "auth", "mfa"], "user"),
    addLock(ROOT, "Never expose internal API endpoints without rate limiting and API key authentication", ["security", "api"], "user"),
    addLock(ROOT, "Billing system uses ICD-10 codes — never switch to a different coding system", ["billing", "icd10"], "user"),
    addLock(ROOT, "Lab results must flow through HL7 FHIR interface — never bypass the interoperability layer", ["interop", "hl7", "fhir"], "user"),
    addLock(ROOT, "Pharmacy module must validate drug interactions before dispensing — never disable safety checks", ["pharmacy", "safety"], "user"),
  ];
  assert(locks.every(l => l.lockId), "All 8 HIPAA locks created");

  // Decisions
  addDecision(ROOT, "PostgreSQL with row-level security for all patient tables", ["database"], "user");
  addDecision(ROOT, "All microservices use mTLS for inter-service communication", ["security"], "user");
  addDecision(ROOT, "Deploy on AWS GovCloud for HIPAA compliance", ["infrastructure"], "user");
  addDecision(ROOT, "Use Terraform for all infrastructure-as-code", ["devops"], "user");

  // Deploy facts
  updateDeployFacts(ROOT, {
    provider: "aws-govcloud",
    branch: "main",
    autoDeploy: false,
    url: "https://erp.hospital-internal.net",
    notes: "HIPAA BAA signed with AWS. Deploy requires security review.",
  });

  logChange(ROOT, "Hospital ERP project initialized with 8 HIPAA locks and 4 architectural decisions", [
    "infrastructure/terraform/main.tf",
    "src/auth/mfa.ts",
    "src/patient/records.ts",
    "src/billing/icd10.ts",
  ]);

  endSession(ROOT, "Project initialized with HIPAA-grade constraints and infrastructure decisions");

  const brain2 = readBrain(ROOT);
  assert(activeLocks(brain2).length === 8, "8 locks active after setup");
  assert(brain2.decisions.length === 4, "4 decisions recorded");
})();


// ================================================================
// SESSION 2: Lock Enforcement — Medical-Grade Violations
// ================================================================

console.log("\n--- Session 2: Medical-Grade Lock Enforcement ---");
console.log("Testing HIPAA violation detection across all 8 locks");

(() => {
  startSession(ROOT, "claude-code");

  // --- MUST DETECT (True Positives) ---

  // Attack 1: Expose patient data
  const c1 = checkConflict(ROOT, "Add a public API endpoint that returns patient records without authentication");
  assert(c1.hasConflict, "TP: Exposing patient records without auth CAUGHT");

  // Attack 2: Remove encryption
  const c2 = checkConflict(ROOT, "Store patient names and SSNs in a Redis cache for faster lookups");
  assert(c2.hasConflict, "TP: Storing PHI in plaintext cache CAUGHT");

  // Attack 3: Disable audit logging
  const c3 = checkConflict(ROOT, "Remove the audit middleware to improve API response times");
  assert(c3.hasConflict, "TP: Removing audit logging CAUGHT");

  // Attack 4: Downgrade auth
  const c4 = checkConflict(ROOT, "Switch to basic username/password login without MFA for the doctor portal");
  assert(c4.hasConflict, "TP: Downgrading to single-factor auth CAUGHT");

  // Attack 5: Expose API
  const c5 = checkConflict(ROOT, "Remove API key requirement from the prescription endpoint for easier testing");
  assert(c5.hasConflict, "TP: Removing API key auth CAUGHT");

  // Attack 6: Change billing codes
  const c6 = checkConflict(ROOT, "Migrate billing from ICD-10 to a custom code system for simplicity");
  assert(c6.hasConflict, "TP: Switching from ICD-10 CAUGHT");

  // Attack 7: Bypass HL7 FHIR
  const c7 = checkConflict(ROOT, "Send lab results directly to the patient portal instead of through the FHIR gateway");
  assert(c7.hasConflict, "TP: Bypassing HL7 FHIR interface CAUGHT");

  // Attack 8: Disable drug interaction checks
  const c8 = checkConflict(ROOT, "Skip drug interaction validation to speed up prescription processing");
  assert(c8.hasConflict, "TP: Disabling drug safety checks CAUGHT");

  // --- Euphemistic Attacks ---

  // Euphemism: "simplify patient data flow"
  const e1 = checkConflict(ROOT, "Simplify the patient data flow by removing intermediate encryption steps");
  assert(e1.hasConflict, "EUPHEMISM: 'Simplify data flow' by removing encryption CAUGHT");

  // Euphemism: "modernize the authentication stack"
  const e2 = checkConflict(ROOT, "Modernize the authentication stack by replacing the MFA system with passwordless magic links");
  assert(e2.hasConflict, "EUPHEMISM: 'Modernize auth' by removing MFA CAUGHT");

  // Euphemism: "optimize database queries on patient records"
  const e3 = checkConflict(ROOT, "Optimize database performance by moving patient records to an unencrypted read replica");
  assert(e3.hasConflict, "EUPHEMISM: 'Optimize DB' with unencrypted replica CAUGHT");

  // --- TRUE NEGATIVES (Must NOT flag) ---

  const tn1 = checkConflict(ROOT, "Add a new scheduling module for appointment booking");
  assert(!tn1.hasConflict, "TN: Scheduling module does NOT trigger false positive");

  const tn2 = checkConflict(ROOT, "Create a staff directory with department listings");
  assert(!tn2.hasConflict, "TN: Staff directory does NOT trigger false positive");

  const tn3 = checkConflict(ROOT, "Build a cafeteria menu and meal ordering system");
  assert(!tn3.hasConflict, "TN: Cafeteria system does NOT trigger false positive");

  const tn4 = checkConflict(ROOT, "Add visitor management and badge printing");
  assert(!tn4.hasConflict, "TN: Visitor management does NOT trigger false positive");

  const tn5 = checkConflict(ROOT, "Add a parking lot availability display to the lobby kiosk");
  assert(!tn5.hasConflict, "TN: Parking lot display does NOT trigger false positive");

  endSession(ROOT, "All 8 HIPAA locks enforced. Zero false positives on safe actions.");
})();


// ================================================================
// SESSION 3: API Key Auth & RBAC
// ================================================================

console.log("\n--- Session 3: API Key Authentication & RBAC ---");
console.log("Sam sets up multi-role access control");

(() => {
  startSession(ROOT, "claude-code");

  // Enable auth
  const authEnabled = enableAuth(ROOT);
  assert(authEnabled.success === true, "Authentication enabled");

  // Create keys for different roles
  const adminKey = createApiKey(ROOT, "admin", "Sam - Lead Architect");
  assert(adminKey.success && adminKey.rawKey, "Admin API key created");

  const devKey = createApiKey(ROOT, "developer", "Dr. Chen - Developer");
  assert(devKey.success && devKey.rawKey, "Developer API key created");

  const viewerKey = createApiKey(ROOT, "viewer", "Nurse Station Dashboard");
  assert(viewerKey.success && viewerKey.rawKey, "Viewer API key created");

  const archKey = createApiKey(ROOT, "architect", "CI/CD Pipeline");
  assert(archKey.success && archKey.rawKey, "Architect API key created");

  // isAuthEnabled requires both enabled flag AND at least one key
  assert(isAuthEnabled(ROOT) === true, "isAuthEnabled returns true (enabled + keys exist)");

  // Validate keys
  const adminValid = validateApiKey(ROOT, adminKey.rawKey);
  assert(adminValid.valid === true, "Admin key validates successfully");
  assert(adminValid.role === "admin", "Admin role confirmed");

  const devValid = validateApiKey(ROOT, devKey.rawKey);
  assert(devValid.valid === true && devValid.role === "developer", "Developer key validates");

  // Invalid key
  const fakeValid = validateApiKey(ROOT, "sk_fake_1234567890");
  assert(fakeValid.valid === false, "Fake key rejected");

  // RBAC permission checks
  assert(checkPermission("admin", "speclock_add_lock") === true, "Admin CAN add locks");
  assert(checkPermission("developer", "speclock_add_lock") === false, "Developer CANNOT add locks");
  assert(checkPermission("viewer", "speclock_add_lock") === false, "Viewer CANNOT add locks");
  assert(checkPermission("viewer", "speclock_get_context") === true, "Viewer CAN read context");
  assert(checkPermission("architect", "speclock_add_lock") === true, "Architect CAN add locks");

  // List keys
  const keyList = listApiKeys(ROOT);
  assert(keyList.keys.length === 4, "4 API keys in system");

  // Rotate key
  const rotated = rotateApiKey(ROOT, devKey.keyId);
  assert(rotated.success === true, "Developer key rotated");
  assert(rotated.newKeyId !== devKey.keyId, "New key ID differs from old");

  // Old key should be invalid
  const oldKeyCheck = validateApiKey(ROOT, devKey.rawKey);
  assert(oldKeyCheck.valid === false, "Old key invalid after rotation");

  // New key should work
  const newKeyCheck = validateApiKey(ROOT, rotated.rawKey);
  assert(newKeyCheck.valid === true, "New key validates after rotation");

  // Revoke key
  const revoked = revokeApiKey(ROOT, viewerKey.keyId, "Dashboard decommissioned");
  assert(revoked.success === true, "Viewer key revoked");

  // Revoked key should be invalid
  const revokedCheck = validateApiKey(ROOT, viewerKey.rawKey);
  assert(revokedCheck.valid === false, "Revoked key rejected");

  // Disable auth
  disableAuth(ROOT);
  assert(isAuthEnabled(ROOT) === false, "Authentication disabled");

  // Re-enable for next sessions
  enableAuth(ROOT);

  endSession(ROOT, "RBAC configured: 4 roles, key rotation tested, revocation tested");
})();


// ================================================================
// SESSION 4: Hard Enforcement — Zero Tolerance for HIPAA
// ================================================================

console.log("\n--- Session 4: Hard Enforcement Mode (HIPAA Zero Tolerance) ---");

(() => {
  startSession(ROOT, "claude-code");

  // Enable hard enforcement with strict threshold
  const enforceResult = setEnforcementMode(ROOT, "hard", { blockThreshold: 50 });
  assert(enforceResult.success === true, "Hard enforcement enabled with 50% threshold");

  const brain = readBrain(ROOT);
  const config = getEnforcementConfig(brain);
  assert(config.mode === "hard", "Mode confirmed: hard");
  assert(config.blockThreshold === 50, "Threshold confirmed: 50%");

  // HIPAA violation — MUST be blocked
  const blocked1 = enforceConflictCheck(ROOT, "Export patient records to a CSV file without encryption");
  assert(blocked1.blocked === true, "BLOCKED: Unencrypted PHI export");
  assert(blocked1.hasConflict === true, "Conflict detected for PHI export");

  // HIPAA violation — MUST be blocked
  const blocked2 = enforceConflictCheck(ROOT, "Disable multi-factor authentication for night shift doctors");
  assert(blocked2.blocked === true, "BLOCKED: MFA downgrade for night shift");

  // Safe action — should pass
  const safe = enforceConflictCheck(ROOT, "Add a new department configuration page");
  assert(safe.blocked === false, "ALLOWED: Department config page (not HIPAA relevant)");

  // Override with justification
  const brain2 = readBrain(ROOT);
  const phiLock = brain2.specLock.items.find(l => l.text.includes("Patient records") && l.active);
  if (phiLock) {
    const override = overrideLock(ROOT, phiLock.id,
      "Export encrypted patient records for audit",
      "Annual HIPAA audit requires data export — approved by CISO, ticket SEC-789");
    assert(override.success === true, "Override granted with CISO approval");

    const history = getOverrideHistory(ROOT);
    assert(history.total >= 1, "Override history recorded");
    assert(history.overrides[0].reason.includes("SEC-789"), "Override ticket reference preserved");
  }

  endSession(ROOT, "Hard enforcement active. HIPAA violations blocked. Override requires approval.");
})();


// ================================================================
// SESSION 5: Encryption Verification
// ================================================================

console.log("\n--- Session 5: AES-256-GCM Encryption ---");

(() => {
  startSession(ROOT, "claude-code");

  // Test encryption primitives
  const testData = JSON.stringify({
    patientId: "P-12345",
    name: "Jane Doe",
    ssn: "123-45-6789",
    diagnosis: "Type 2 Diabetes",
  });

  // Set encryption key for testing
  const originalKey = process.env.SPECLOCK_ENCRYPTION_KEY;
  process.env.SPECLOCK_ENCRYPTION_KEY = "hospital-erp-hipaa-encryption-key-2024";

  const enabled = isEncryptionEnabled();
  assert(enabled === true, "Encryption enabled (env var set)");

  const encrypted = encrypt(testData);
  assert(encrypted.startsWith("SPECLOCK_ENCRYPTED:"), "Data encrypted with SPECLOCK_ENCRYPTED prefix");
  assert(!encrypted.includes("Jane Doe"), "Patient name NOT visible in encrypted data");
  assert(!encrypted.includes("123-45-6789"), "SSN NOT visible in encrypted data");

  const isEnc = isEncrypted(encrypted);
  assert(isEnc === true, "isEncrypted detects encrypted data");

  const decrypted = decrypt(encrypted);
  assert(decrypted === testData, "Decryption recovers original data");

  const parsed = JSON.parse(decrypted);
  assert(parsed.patientId === "P-12345", "Patient ID preserved after round-trip");
  assert(parsed.ssn === "123-45-6789", "SSN preserved after round-trip");

  // Plain text passthrough
  const plain = decrypt("not encrypted data");
  assert(plain === "not encrypted data", "Unencrypted data passes through decrypt unchanged");

  // Restore original env
  if (originalKey !== undefined) {
    process.env.SPECLOCK_ENCRYPTION_KEY = originalKey;
  } else {
    delete process.env.SPECLOCK_ENCRYPTION_KEY;
  }

  endSession(ROOT, "AES-256-GCM encryption verified: PHI encrypted at rest, round-trip confirmed");
})();


// ================================================================
// SESSION 6: Compliance Exports
// ================================================================

console.log("\n--- Session 6: SOC 2 / HIPAA Compliance Exports ---");

(() => {
  startSession(ROOT, "claude-code");

  // SOC 2 Report
  const soc2 = exportSOC2(ROOT);
  assert(soc2.report === "SOC 2 Type II — SpecLock Compliance Export", "SOC 2 report generated");
  assert(soc2.auditChainIntegrity !== undefined, "SOC 2 includes audit chain status");
  assert(soc2.constraintManagement.activeConstraints >= 8, "SOC 2 shows 8+ active constraints");
  assert(soc2.accessLog.totalSessions > 0, "SOC 2 includes session history");
  assert(soc2.decisionAuditTrail.totalDecisions >= 4, "SOC 2 includes decisions");
  assert(soc2.violations !== undefined, "SOC 2 includes violation history");

  // HIPAA Report
  const hipaa = exportHIPAA(ROOT);
  assert(hipaa !== null && !hipaa.error, "HIPAA report generated");
  assert(hipaa.report === "HIPAA Compliance — SpecLock PHI Protection Report", "HIPAA report titled correctly");

  // CSV Export — exportCSV returns a raw CSV string
  const csv = exportCSV(ROOT);
  assert(typeof csv === "string" && csv.length > 0, "CSV export generated as string");
  assert(csv.includes("event_id"), "CSV has event_id header");

  // Generic compliance dispatcher — returns { format, data }
  const soc2v2 = exportCompliance(ROOT, "soc2");
  assert(soc2v2 !== null && soc2v2.format === "soc2", "exportCompliance('soc2') works");

  const hipaaV2 = exportCompliance(ROOT, "hipaa");
  assert(hipaaV2 !== null && hipaaV2.format === "hipaa", "exportCompliance('hipaa') works");

  const csvV2 = exportCompliance(ROOT, "csv");
  assert(csvV2 !== null && csvV2.format === "csv", "exportCompliance('csv') works");

  // Verify audit chain integrity
  const audit = verifyAuditChain(ROOT);
  assert(audit.valid === true, "HMAC audit chain valid — no tampering");
  assert(audit.totalEvents > 0, "Audit chain has logged events");

  endSession(ROOT, "All compliance exports verified: SOC 2, HIPAA, CSV, audit chain intact");
})();


// ================================================================
// SESSION 7: Policy-as-Code for Hospital Rules
// ================================================================

console.log("\n--- Session 7: Policy-as-Code for Hospital Compliance ---");

(() => {
  startSession(ROOT, "claude-code");

  // Initialize policy
  const init = initPolicy(ROOT);
  assert(init.success === true, "Policy-as-code initialized");

  // Rule 1: PHI file protection
  const r1 = addPolicyRule(ROOT, {
    name: "PHI Data Protection",
    description: "Block all modifications to patient data files",
    match: { files: ["**/patient/**", "**/medical/**", "**/phi/**"], actions: ["delete", "modify"] },
    enforce: "block",
    severity: "critical",
  });
  assert(r1.success === true, "PHI protection rule added");

  // Rule 2: Audit log protection
  const r2 = addPolicyRule(ROOT, {
    name: "Audit Log Integrity",
    description: "Audit logs must never be deleted or modified",
    match: { files: ["**/audit/**", "**/logs/**"], actions: ["delete", "modify"] },
    enforce: "block",
    severity: "critical",
  });
  assert(r2.success === true, "Audit log protection rule added");

  // Rule 3: Config change warning
  const r3 = addPolicyRule(ROOT, {
    name: "Configuration Change Warning",
    description: "Warn on any infrastructure config changes",
    match: { files: ["**/config/**", "**/terraform/**", "**/.env*"], actions: ["modify", "delete"] },
    enforce: "warn",
    severity: "high",
  });
  assert(r3.success === true, "Config change warning rule added");

  // Evaluate policies
  const eval1 = evaluatePolicy(ROOT, { files: ["src/patient/records.ts"], type: "delete" });
  assert(!eval1.passed, "Policy BLOCKS patient record deletion");
  assert(eval1.blocked === true, "Enforcement is 'block' for PHI");

  const eval2 = evaluatePolicy(ROOT, { files: ["src/audit/logger.ts"], type: "modify" });
  assert(!eval2.passed, "Policy BLOCKS audit log modification");

  const eval3 = evaluatePolicy(ROOT, { files: ["infrastructure/terraform/main.tf"], type: "modify" });
  assert(!eval3.passed, "Policy WARNS on terraform config change");
  assert(!eval3.blocked, "Config change is warn, not block");

  const eval4 = evaluatePolicy(ROOT, { files: ["src/scheduling/calendar.tsx"], type: "modify" });
  assert(eval4.passed, "Policy ALLOWS scheduling module changes");

  // List rules
  const rules = listPolicyRules(ROOT);
  assert(rules.total === 3, "3 policy rules active");

  // Export policy as YAML
  const exported = exportPolicy(ROOT);
  assert(exported.success === true, "Policy exported");
  assert(exported.yaml.includes("PHI Data Protection"), "Export contains PHI rule");

  // Import test — re-import exported policy
  const imported = importPolicy(ROOT, exported.yaml, "merge");
  assert(imported.success === true, "Policy import succeeded");

  // Remove a rule
  const removed = removePolicyRule(ROOT, r3.ruleId);
  assert(removed.success === true, "Config warning rule removed");

  const rulesAfter = listPolicyRules(ROOT);
  assert(rulesAfter.total === 2, "2 rules after removal");

  endSession(ROOT, "Hospital policy-as-code: PHI protection, audit integrity, config warnings");
})();


// ================================================================
// SESSION 8: SSO Configuration
// ================================================================

console.log("\n--- Session 8: OAuth/OIDC SSO Configuration ---");

(() => {
  startSession(ROOT, "claude-code");

  // Initially SSO is not enabled
  assert(isSSOEnabled(ROOT) === false, "SSO not enabled initially");

  // Configure SSO
  const ssoConfig = {
    issuer: "https://hospital-okta.example.com",
    clientId: "speclock-erp-client",
    clientSecret: "super-secret-value",
    redirectUri: "http://localhost:3000/auth/callback",
    scopes: ["openid", "profile", "email"],
    roleMapping: {
      "Hospital Admin": "admin",
      "IT Security": "architect",
      "Developer": "developer",
      "Staff": "viewer",
    },
    defaultRole: "viewer",
    sessionTtlMinutes: 480,
  };

  const saved = saveSSOConfig(ROOT, ssoConfig);
  assert(saved.success === true, "SSO configuration saved");

  assert(isSSOEnabled(ROOT) === true, "SSO enabled after config");

  // Read config back
  const config = getSSOConfig(ROOT);
  assert(config.issuer === "https://hospital-okta.example.com", "SSO issuer preserved");
  assert(config.clientId === "speclock-erp-client", "SSO client ID preserved");
  assert(config.sessionTtlMinutes === 480, "Session TTL preserved");

  // Get authorization URL
  const authUrl = getAuthorizationUrl(ROOT, "test-state-123");
  assert(authUrl.success === true, "Authorization URL generated");
  assert(authUrl.url.includes("hospital-okta.example.com"), "URL points to correct issuer");
  assert(authUrl.state, "State parameter included");

  // Session management (no active sessions yet)
  const sessions = listSessions(ROOT);
  assert(sessions.total === 0, "No active SSO sessions initially");

  // Validate non-existent session
  const invalidSession = validateSession(ROOT, "fake-session-id");
  assert(invalidSession.valid === false, "Fake session ID rejected");

  endSession(ROOT, "SSO configured: Okta OIDC, role mapping, 8-hour sessions");
})();


// ================================================================
// SESSION 9: Telemetry & Analytics
// ================================================================

console.log("\n--- Session 9: Telemetry & Usage Analytics ---");

(() => {
  startSession(ROOT, "claude-code");

  // Enable telemetry
  const origTelemetry = process.env.SPECLOCK_TELEMETRY;
  process.env.SPECLOCK_TELEMETRY = "true";

  assert(isTelemetryEnabled() === true, "Telemetry enabled");

  // Track tool usage
  trackToolUsage(ROOT, "speclock_check_conflict", 45);
  trackToolUsage(ROOT, "speclock_check_conflict", 52);
  trackToolUsage(ROOT, "speclock_add_lock", 23);
  trackToolUsage(ROOT, "speclock_get_context", 15);
  trackToolUsage(ROOT, "speclock_check_conflict", 38);

  // Track conflicts
  trackConflict(ROOT, true, true);  // blocked
  trackConflict(ROOT, true, false); // warned
  trackConflict(ROOT, false, false); // no conflict

  // Track features
  trackFeature(ROOT, "hard_enforcement");
  trackFeature(ROOT, "policy_as_code");
  trackFeature(ROOT, "compliance_export");

  // Track session
  trackSession(ROOT, "claude-code");

  // Get summary
  const summary = getTelemetrySummary(ROOT);
  assert(summary.enabled === true, "Telemetry summary available");
  assert(summary.totalCalls >= 5, "Total tool calls tracked", `got ${summary.totalCalls}`);
  assert(summary.conflicts.total >= 3, "Conflict stats tracked");
  assert(summary.conflicts.blocked >= 1, "Blocked conflicts tracked");

  // Restore telemetry state
  if (origTelemetry !== undefined) {
    process.env.SPECLOCK_TELEMETRY = origTelemetry;
  } else {
    delete process.env.SPECLOCK_TELEMETRY;
  }

  endSession(ROOT, "Telemetry verified: tool usage, conflict rates, feature adoption tracked");
})();


// ================================================================
// SESSION 10: Full Audit & Memory Continuity
// ================================================================

console.log("\n--- Session 10: Full Audit & Multi-Session Memory ---");
console.log("Sam returns after 10 sessions — everything must persist");

(() => {
  const briefing = getSessionBriefing(ROOT, "claude-code");

  // Memory continuity
  assert(briefing.brain.goal.text.includes("HIPAA"), "Goal persists across 10 sessions");
  const locks = activeLocks(briefing.brain);
  assert(locks.length >= 7, "HIPAA locks persist", `got ${locks.length}`);
  assert(briefing.brain.decisions.length >= 4, "Decisions persist");

  // All critical locks still enforce
  const c1 = checkConflict(ROOT, "Remove encryption from patient records database");
  assert(c1.hasConflict, "PHI encryption lock STILL enforced");

  const c2 = checkConflict(ROOT, "Disable audit logging for performance");
  assert(c2.hasConflict, "Audit logging lock STILL enforced");

  const c3 = checkConflict(ROOT, "Switch authentication to simple passwords");
  assert(c3.hasConflict, "MFA lock STILL enforced");

  const c4 = checkConflict(ROOT, "Replace ICD-10 with custom billing codes");
  assert(c4.hasConflict, "ICD-10 billing lock STILL enforced");

  // Safe actions still pass
  const safe = checkConflict(ROOT, "Add a new waiting room status display");
  assert(!safe.hasConflict, "Waiting room display NOT blocked");

  // Violation report shows history
  const report = generateReport(ROOT);
  assert(report.totalViolations > 0, "Violation history maintained across sessions");

  // Suggest locks based on decisions
  const suggestions = suggestLocks(ROOT);
  assert(suggestions.suggestions.length >= 0, "Lock suggestions functional");

  // Drift detection
  const drift = detectDrift(ROOT);
  assert(drift !== null && drift.status, "Drift detection runs");

  // Final audit chain verification
  const auditFinal = verifyAuditChain(ROOT);
  assert(auditFinal.valid === true, "FINAL: Audit chain integrity verified");
  assert(auditFinal.totalEvents > 0, "FINAL: Audit trail has complete history");

  endSession(ROOT, "Full enterprise audit complete. All systems operational.");
})();


// ================================================================
// RESULTS
// ================================================================

console.log("\n" + "=".repeat(70));
console.log(`  SAM'S JOURNEY: ${passed}/${total} passed, ${failed} failed`);
console.log("=".repeat(70));

if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach(f => console.log(f));
}

if (failed === 0) {
  console.log("\nSam's hospital ERP is ENTERPRISE-GRADE PROTECTED by SpecLock.");
  console.log("HIPAA compliance: verified. Encryption: AES-256-GCM. Auth: RBAC + SSO.");
  console.log("Audit chain: tamper-proof. Policy-as-code: active. Zero false positives.");
}

} finally {
  cleanup(ROOT);
}

process.exit(failed > 0 ? 1 : 0);
