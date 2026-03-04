// ===================================================================
// JOHN'S JOURNEY — Vibecoder on Bolt.new building an Ecommerce App
// ===================================================================
// John is a regular vibecoder who uses Bolt.new. He doesn't know about
// MCP or semantic engines. He just says "Install speclock and set up
// project memory." This test simulates his ENTIRE journey.
//
// Run: node tests/john-vibecoder-journey.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";

// Import everything John's journey touches
import {
  ensureSpeclockDirs,
  makeBrain,
  writeBrain,
  readBrain,
  appendEvent,
} from "../src/core/storage.js";

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
  auditStagedFiles,
  startSession,
  endSession,
  getSessionBriefing,
  getEnforcementConfig,
  setEnforcementMode,
  enforceConflictCheck,
  overrideLock,
  getOverrideHistory,
} from "../src/core/engine.js";

import {
  initPolicy,
  addPolicyRule,
  evaluatePolicy,
  listPolicyRules,
  exportPolicy,
} from "../src/core/policy.js";

import {
  isTelemetryEnabled,
  trackToolUsage,
  getTelemetrySummary,
} from "../src/core/telemetry.js";

import {
  verifyAuditChain,
} from "../src/core/audit.js";

import {
  exportSOC2,
  exportHIPAA,
} from "../src/core/compliance.js";

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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "john-ecommerce-"));
  ensureSpeclockDirs(tmpDir);
  const brain = makeBrain(tmpDir, false, "main");
  writeBrain(tmpDir, brain);
  return tmpDir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// Helper: get active locks from brain
function activeLocks(brain) {
  return (brain.specLock?.items || []).filter(l => l.active !== false);
}

// ================================================================
// SESSION 1: "Install speclock and set up project memory"
// ================================================================

console.log("\n" + "=".repeat(70));
console.log("  JOHN'S JOURNEY — Vibecoder Ecommerce App on Bolt.new");
console.log("=".repeat(70));

const ROOT = createProject();

try {

console.log("\n--- Session 1: Initial Setup ---");
console.log("John says: 'Install speclock and set up project memory for my ecommerce app'");

(() => {
  // Step 1: Init
  const brain = readBrain(ROOT);
  assert(brain !== null, "SpecLock initialized in project");

  // Step 2: Set goal — returns brain object
  const goalBrain = setGoal(ROOT, "Build a modern ecommerce app with Stripe payments, Firebase database, Supabase edge functions, and NextAuth authentication");
  assert(goalBrain.goal.text.includes("ecommerce"), "Goal set for ecommerce app");

  // Step 3: Start session — returns { brain, session }
  const session = startSession(ROOT, "bolt.new");
  assert(session.session !== null && session.session.id, "Session started on Bolt.new");

  // Step 4: John locks his auth system — addLock(root, text, tags, source)
  const authLock = addLock(ROOT, "Never modify the authentication system — NextAuth config, login flow, and session management must not be changed", ["auth", "security"], "user");
  assert(authLock.lockId && authLock.lockId.startsWith("lock_"), "Auth lock added");
  const authLockId = authLock.lockId;

  // Step 5: John locks his database choice
  const dbLock = addLock(ROOT, "Database storage is Firebase Firestore — never switch to another database or change the Firebase config", ["database", "firebase"], "user");
  assert(dbLock.lockId && dbLock.lockId.startsWith("lock_"), "Firebase database lock added");

  // Step 6: John locks his edge functions
  const edgeLock = addLock(ROOT, "All serverless edge functions must use Supabase Edge Functions — do not move them to Vercel, AWS Lambda, or any other provider", ["edge", "supabase"], "user");
  assert(edgeLock.lockId, "Supabase edge functions lock added");

  // Step 7: John locks a specific TypeScript function
  const funcLock = addLock(ROOT, "Do not touch or modify the calculateShipping() function in src/utils/shipping.ts — it has been validated with the logistics partner", ["shipping", "do-not-touch"], "user");
  assert(funcLock.lockId, "Specific function lock added");

  // Step 8: John locks the payment integration
  const paymentLock = addLock(ROOT, "Stripe is the payment processor — never switch to PayPal, Square, or any other payment system", ["payments", "stripe"], "user");
  assert(paymentLock.lockId, "Stripe payment lock added");

  // Step 9: John makes some decisions — addDecision(root, text, tags, source)
  const d1 = addDecision(ROOT, "Use TailwindCSS for all styling — no other CSS framework", ["styling"], "user");
  assert(d1.decId, "TailwindCSS decision recorded");

  const d2 = addDecision(ROOT, "Product images stored in Firebase Storage with CDN", ["storage"], "user");
  assert(d2.decId, "Image storage decision recorded");

  const d3 = addDecision(ROOT, "Use React Query for all API state management", ["state"], "user");
  assert(d3.decId, "React Query decision recorded");

  // Step 10: Log initial setup — returns { brain, eventId }
  const change = logChange(ROOT, "Initial project setup: NextAuth, Firebase, Supabase edge functions, Stripe payments", ["package.json", "src/config/firebase.ts", "src/config/stripe.ts", "src/auth/[...nextauth].ts"]);
  assert(change.eventId, "Setup change logged");

  // Step 11: Deploy facts — returns brain
  const deployBrain = updateDeployFacts(ROOT, { provider: "vercel", branch: "main", autoDeploy: true, url: "https://johns-shop.vercel.app" });
  assert(deployBrain.facts.deploy.provider === "vercel", "Deploy facts recorded");

  // Step 12: End session — returns { brain, ended, session }
  const endResult = endSession(ROOT, "Set up ecommerce project with all core constraints locked");
  assert(endResult.ended === true, "Session 1 ended");

  // Verify brain state
  const brain2 = readBrain(ROOT);
  const locks = activeLocks(brain2);
  assert(locks.length === 5, "5 locks active", `got ${locks.length}`);
  assert(brain2.decisions.length === 3, "3 decisions recorded");
  assert(brain2.goal.text.includes("ecommerce"), "Goal mentions ecommerce");
})();


// ================================================================
// SESSION 2: John returns, AI tries to break things
// ================================================================

console.log("\n--- Session 2: John Returns — Testing Lock Enforcement ---");
console.log("John says: 'Add social login with Google and GitHub to my app'");

(() => {
  // Step 1: New session — AI reads context via briefing
  // getSessionBriefing returns { brain, session, lastSession, changesSinceLastSession, warnings }
  const briefing = getSessionBriefing(ROOT, "bolt.new");
  assert(briefing.brain !== null, "Session briefing loads full context");
  const locks = activeLocks(briefing.brain);
  assert(locks.length === 5, "Briefing shows 5 locks");
  assert(briefing.brain.goal.text.includes("ecommerce"), "Goal preserved across sessions");

  // Step 2: AI tries to add social login — should conflict with auth lock
  const conflict1 = checkConflict(ROOT, "Add Google and GitHub social login to the authentication page");
  assert(conflict1.hasConflict, "Social login conflicts with auth lock");
  assert(conflict1.conflictingLocks[0].confidence >= 70, "High confidence auth conflict", `confidence: ${conflict1.conflictingLocks[0].confidence}`);

  // Step 3: John says "change the database to MongoDB for better performance"
  const conflict2 = checkConflict(ROOT, "Migrate the database from Firebase to MongoDB for better query performance");
  assert(conflict2.hasConflict, "MongoDB migration conflicts with Firebase lock");
  assert(conflict2.conflictingLocks[0].confidence >= 70, "High confidence DB conflict", `confidence: ${conflict2.conflictingLocks[0].confidence}`);

  // Step 4: "Move edge functions to Vercel serverless"
  const conflict3 = checkConflict(ROOT, "Move all edge functions from Supabase to Vercel serverless functions for faster cold starts");
  assert(conflict3.hasConflict, "Vercel migration conflicts with Supabase lock");

  // Step 5: "Optimize the calculateShipping function"
  const conflict4 = checkConflict(ROOT, "Refactor and optimize the calculateShipping function in shipping.ts to reduce API calls");
  assert(conflict4.hasConflict, "Shipping function refactor conflicts with do-not-touch lock");

  // Step 6: "Switch payments to PayPal"
  const conflict5 = checkConflict(ROOT, "Replace Stripe with PayPal for lower transaction fees");
  assert(conflict5.hasConflict, "PayPal switch conflicts with Stripe lock");

  // Step 7: "Add a new product page" — should NOT conflict
  const noConflict1 = checkConflict(ROOT, "Create a new product listing page with search and filters");
  assert(!noConflict1.hasConflict, "New product page does NOT conflict (no lock violated)");

  // Step 8: "Add a shopping cart" — should NOT conflict
  const noConflict2 = checkConflict(ROOT, "Build a shopping cart component with add/remove/quantity");
  assert(!noConflict2.hasConflict, "Shopping cart does NOT conflict");

  // Step 9: "Add dark mode" — should NOT conflict
  const noConflict3 = checkConflict(ROOT, "Implement dark mode toggle using TailwindCSS dark classes");
  assert(!noConflict3.hasConflict, "Dark mode does NOT conflict");

  // Step 10: "Add customer reviews" — should NOT conflict
  const noConflict4 = checkConflict(ROOT, "Add a customer review and rating system for products");
  assert(!noConflict4.hasConflict, "Customer reviews does NOT conflict");

  // Step 11: "Add order tracking" — should NOT conflict
  const noConflict5 = checkConflict(ROOT, "Build an order tracking page that shows shipping status");
  assert(!noConflict5.hasConflict, "Order tracking does NOT conflict");

  // Step 12: Log what was actually built
  logChange(ROOT, "Built product listing page and shopping cart", ["src/pages/products.tsx", "src/components/Cart.tsx"]);
  endSession(ROOT, "Added product page and cart. All constraints respected.");
})();


// ================================================================
// SESSION 3: Sneaky/Euphemistic Violation Attempts
// ================================================================

console.log("\n--- Session 3: Euphemistic & Sneaky Violation Attempts ---");
console.log("Testing if SpecLock catches indirect/euphemistic attacks");

(() => {
  startSession(ROOT, "bolt.new");

  // Euphemism: "clean up the auth code" = modify auth
  const e1 = checkConflict(ROOT, "Clean up and refactor the authentication code for better maintainability");
  assert(e1.hasConflict, "EUPHEMISM: 'Clean up auth code' caught as auth violation");

  // Euphemism: "modernize the database layer" = change database
  const e2 = checkConflict(ROOT, "Modernize the database layer to use a more scalable solution");
  assert(e2.hasConflict, "EUPHEMISM: 'Modernize database layer' caught as DB violation");

  // Euphemism: "streamline serverless architecture" = move edge functions
  const e3 = checkConflict(ROOT, "Streamline the serverless architecture by consolidating all functions into one provider");
  assert(e3.hasConflict, "EUPHEMISM: 'Streamline serverless' caught as edge function violation");

  // Euphemism: "optimize payment processing pipeline" = touch Stripe
  const e4 = checkConflict(ROOT, "Optimize the payment processing pipeline by evaluating alternative payment gateways");
  assert(e4.hasConflict, "EUPHEMISM: 'Evaluate alternative payment gateways' caught as Stripe violation");

  // Compound: "Add dark mode AND also update the login flow"
  const e5 = checkConflict(ROOT, "Add dark mode to the app and also update the login flow to be more user friendly");
  assert(e5.hasConflict, "COMPOUND: 'Add dark mode AND update login flow' — hidden auth violation caught");

  // Temporal: "Temporarily switch to PostgreSQL for testing"
  const e6 = checkConflict(ROOT, "Temporarily switch the database to PostgreSQL just for local testing");
  assert(e6.hasConflict, "TEMPORAL: 'Temporarily switch database' caught — temporary doesn't bypass locks");

  // Innocent-sounding: "Improve the user experience of the login page"
  const e7 = checkConflict(ROOT, "Improve the user experience of the login page with better error messages and loading states");
  assert(e7.hasConflict, "UX DISGUISE: 'Improve login page UX' caught as auth file modification");

  // TRUE NEGATIVE: "Add a newsletter signup form" — NOT related to any lock
  const tn1 = checkConflict(ROOT, "Add a newsletter signup form to the footer");
  assert(!tn1.hasConflict, "TRUE NEGATIVE: Newsletter signup does NOT trigger false positive");

  // TRUE NEGATIVE: "Add SEO meta tags" — NOT related to any lock
  const tn2 = checkConflict(ROOT, "Add SEO meta tags and Open Graph images to all pages");
  assert(!tn2.hasConflict, "TRUE NEGATIVE: SEO meta tags does NOT trigger false positive");

  // TRUE NEGATIVE: "Create an admin dashboard"
  const tn3 = checkConflict(ROOT, "Create an admin dashboard to view orders and manage inventory");
  assert(!tn3.hasConflict, "TRUE NEGATIVE: Admin dashboard does NOT trigger false positive");

  // TRUE NEGATIVE: "Add email notifications for orders"
  const tn4 = checkConflict(ROOT, "Set up email notifications to send order confirmations to customers");
  assert(!tn4.hasConflict, "TRUE NEGATIVE: Email notifications does NOT trigger false positive");

  // TRUE NEGATIVE: "Optimize images for performance"
  const tn5 = checkConflict(ROOT, "Compress and optimize product images for faster page loading");
  assert(!tn5.hasConflict, "TRUE NEGATIVE: Image optimization does NOT trigger false positive");

  endSession(ROOT, "Tested euphemistic violation attempts — all caught correctly");
})();


// ================================================================
// SESSION 4: John Unlocks, Changes, Relocks
// ================================================================

console.log("\n--- Session 4: Unlock → Change → Relock Workflow ---");
console.log("John says: 'Actually, unlock the auth files, I want to add Google login'");

(() => {
  startSession(ROOT, "bolt.new");

  // Find the auth lock ID — brain.specLock.items
  const brain = readBrain(ROOT);
  const authLock = brain.specLock.items.find(l => l.text.includes("authentication system") && l.active);
  assert(authLock !== undefined, "Auth lock found in brain");

  // Unlock it — removeLock returns { brain, removed, lockText }
  const removed = removeLock(ROOT, authLock.id);
  assert(removed.removed === true, "Auth lock removed");

  // Now the same action should NOT conflict
  const noConflict = checkConflict(ROOT, "Add Google and GitHub social login to the authentication page");
  assert(!noConflict.hasConflict, "Social login is now ALLOWED after unlock");

  // Log the change
  logChange(ROOT, "Added Google and GitHub social login via NextAuth providers", ["src/auth/[...nextauth].ts", "src/components/LoginButton.tsx"]);

  // Re-lock with updated constraint — addLock(root, text, tags, source)
  const newLock = addLock(ROOT, "Auth system now includes Google and GitHub OAuth — do not modify the OAuth provider config or remove any login methods", ["auth", "oauth"], "user");
  assert(newLock.lockId, "Auth re-locked with updated constraint");

  // Verify the new lock works
  const conflict = checkConflict(ROOT, "Remove the GitHub login option to simplify the auth flow");
  assert(conflict.hasConflict, "Removing GitHub login conflicts with new auth lock");

  // Verify other locks still work
  const dbConflict = checkConflict(ROOT, "Switch to PostgreSQL for the product catalog");
  assert(dbConflict.hasConflict, "Firebase lock still enforced after auth changes");

  // Count active locks: original 5, removed 1, added 1 = 5 active
  const brain2 = readBrain(ROOT);
  const locks = activeLocks(brain2);
  assert(locks.length === 5, "Still 5 active locks (1 removed, 1 added)", `got ${locks.length}`);

  endSession(ROOT, "Unlocked auth, added social login, re-locked with updated constraints");
})();


// ================================================================
// SESSION 5: Hard Enforcement Mode
// ================================================================

console.log("\n--- Session 5: Hard Enforcement Mode ---");
console.log("John enables hard mode to completely block violations");

(() => {
  startSession(ROOT, "bolt.new");

  // Enable hard enforcement — setEnforcementMode(root, mode, options)
  const enforceResult = setEnforcementMode(ROOT, "hard", { blockThreshold: 70 });
  assert(enforceResult.success === true, "Hard enforcement enabled");

  // Check config — getEnforcementConfig takes BRAIN, not root
  const brain = readBrain(ROOT);
  const config = getEnforcementConfig(brain);
  assert(config.mode === "hard", "Enforcement mode is 'hard'");
  assert(config.blockThreshold === 70, "Block threshold is 70%");

  // Try a violation — should be BLOCKED
  const enforced = enforceConflictCheck(ROOT, "Replace Firebase with Supabase database");
  assert(enforced.blocked === true, "HARD: Firebase replacement BLOCKED (not just warned)");
  assert(enforced.hasConflict === true, "HARD: Conflict detected");

  // Try a safe action — should pass
  const safe = enforceConflictCheck(ROOT, "Add a new product category filter component");
  assert(safe.blocked === false, "SAFE: Product filter is NOT blocked");

  // Override with reason — overrideLock(root, lockId, action, reason)
  const brain2 = readBrain(ROOT);
  const dbLock = brain2.specLock.items.find(l => l.text.includes("Firebase") && l.active);
  if (dbLock) {
    const override = overrideLock(ROOT, dbLock.id, "Migrate Firebase to Supabase", "PM approved migration to Supabase for cost savings — ticket SHOP-1234");
    assert(override.success === true, "Override accepted with business justification");

    // Check override history — returns { overrides, total }
    const history = getOverrideHistory(ROOT);
    assert(history.total >= 1, "Override recorded in history");
    assert(history.overrides[0].reason.includes("SHOP-1234"), "Override reason preserved");
  }

  endSession(ROOT, "Tested hard enforcement — violations blocked, overrides logged");
})();


// ================================================================
// SESSION 6: Violation Report & Audit
// ================================================================

console.log("\n--- Session 6: Reports & Audit Chain ---");

(() => {
  startSession(ROOT, "bolt.new");

  // Generate violation report — returns { totalViolations, ... }
  const report = generateReport(ROOT);
  assert(report !== null, "Violation report generated");
  assert(typeof report.totalViolations === "number", "Report has totalViolations count");

  // Verify audit chain
  const auditResult = verifyAuditChain(ROOT);
  assert(auditResult.valid, "HMAC audit chain is valid — no tampering detected");
  assert(auditResult.totalEvents > 0, "Audit chain has events", `events: ${auditResult.totalEvents}`);

  // Compliance exports — SOC 2
  const soc2 = exportSOC2(ROOT);
  assert(soc2 !== null, "SOC 2 report generated");
  assert(soc2.report === "SOC 2 Type II — SpecLock Compliance Export", "Report type is SOC 2");
  assert(soc2.constraintManagement.activeConstraints > 0, "SOC 2 report includes active constraints");

  // HIPAA report
  const hipaa = exportHIPAA(ROOT);
  assert(hipaa !== null, "HIPAA report generated");

  // Drift detection (no actual file changes, but function should work)
  const drift = detectDrift(ROOT);
  assert(drift !== null, "Drift detection runs");

  endSession(ROOT, "Generated reports and verified audit chain integrity");
})();


// ================================================================
// SESSION 7: Policy-as-Code for Store Rules
// ================================================================

console.log("\n--- Session 7: Policy-as-Code for Ecommerce Rules ---");

(() => {
  startSession(ROOT, "bolt.new");

  // Initialize policy
  const policyInit = initPolicy(ROOT);
  assert(policyInit.success === true, "Policy-as-code initialized");

  // Add ecommerce-specific rules
  const r1 = addPolicyRule(ROOT, {
    name: "Protect checkout flow",
    match: { files: ["**/checkout/**", "**/payment/**"], actions: ["delete", "modify"] },
    enforce: "block",
    severity: "critical",
  });
  assert(r1.success === true, "Checkout protection rule added");

  const r2 = addPolicyRule(ROOT, {
    name: "Price modification warning",
    match: { files: ["**/pricing/**", "**/products/price*"], actions: ["modify"] },
    enforce: "warn",
    severity: "high",
  });
  assert(r2.success === true, "Price modification warning rule added");

  // Evaluate policies — evaluatePolicy(root, action) where action has { files, type }
  const eval1 = evaluatePolicy(ROOT, { files: ["src/checkout/payment-form.tsx"], type: "delete" });
  assert(!eval1.passed, "Policy BLOCKS checkout file deletion");
  assert(eval1.blocked === true, "Policy enforcement is 'block'");

  const eval2 = evaluatePolicy(ROOT, { files: ["src/pricing/calculator.ts"], type: "modify" });
  assert(!eval2.passed, "Policy WARNS on price file modification");
  assert(!eval2.blocked, "Price modification is warning, not block");

  const eval3 = evaluatePolicy(ROOT, { files: ["src/components/ProductCard.tsx"], type: "modify" });
  assert(eval3.passed, "Policy ALLOWS normal component modification");

  // List rules — returns { rules, total, active }
  const rules = listPolicyRules(ROOT);
  assert(rules.total === 2, "2 policy rules active");

  // Export
  const exported = exportPolicy(ROOT);
  assert(exported.success === true, "Policy exported as YAML");
  assert(exported.yaml.includes("Protect checkout flow"), "Export contains rule name");

  endSession(ROOT, "Set up policy-as-code rules for ecommerce");
})();


// ================================================================
// SESSION 8: Multi-Session Memory Continuity
// ================================================================

console.log("\n--- Session 8: Multi-Session Continuity Check ---");
console.log("Simulating 5 sessions later — does memory persist?");

(() => {
  // Start a fresh session — simulate "5 sessions later"
  // getSessionBriefing returns { brain, session, lastSession, ... }
  const briefing = getSessionBriefing(ROOT, "bolt.new");

  // Everything should be remembered
  assert(briefing.brain.goal.text.includes("ecommerce"), "Goal still remembered after many sessions");
  const locks = activeLocks(briefing.brain);
  assert(locks.length >= 4, "Locks preserved across sessions", `got ${locks.length}`);
  assert(briefing.brain.decisions.length >= 3, "Decisions preserved");

  // Lock enforcement still works
  const conflict = checkConflict(ROOT, "Switch from Stripe to a custom payment processor");
  assert(conflict.hasConflict, "Stripe lock STILL enforced after 8 sessions");

  // Shipping function lock still works
  const conflict2 = checkConflict(ROOT, "Rewrite the calculateShipping function to use a new API");
  assert(conflict2.hasConflict, "Shipping function lock STILL enforced");

  // Safe actions still work
  const noConflict = checkConflict(ROOT, "Add a wishlist feature for customers");
  assert(!noConflict.hasConflict, "Wishlist feature NOT blocked");

  endSession(ROOT, "Verified multi-session memory continuity");
})();


// ================================================================
// RESULTS
// ================================================================

console.log("\n" + "=".repeat(70));
console.log(`  JOHN'S JOURNEY: ${passed}/${total} passed, ${failed} failed`);
console.log("=".repeat(70));

if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach(f => console.log(f));
}

if (failed === 0) {
  console.log("\nJohn's ecommerce app is FULLY PROTECTED by SpecLock.");
  console.log("Every violation caught. Zero false positives. Memory persists.");
}

} finally {
  cleanup(ROOT);
}

process.exit(failed > 0 ? 1 : 0);
