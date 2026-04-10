/**
 * Synonym Gaps Test
 *
 * Regression tests for delete-related verb synonyms and user-entity synonyms
 * that were previously missed by the semantic engine.
 *
 * Background:
 *   The end-to-end test revealed that "wipes records" was MISSED entirely and
 *   "purge users" scored only LOW 28%. The synonym taxonomy had holes around
 *   destructive verbs (wipe, purge, scrub, nuke, …) and user-entity nouns
 *   (accounts, customers, members, profiles).
 *
 * This suite locks in the expanded synonym groups so regressions are caught.
 */

import { analyzeConflict } from "../src/core/semantics.js";

const TARGET_LOCK = "NEVER delete user data";

const CONFLICTS = [
  // Required by the bug report.
  ["wipe all user records", "wipe → delete, records → data"],
  ["purge customer accounts", "purge → delete, customer → user, accounts → user"],
  ["clear out old data", "clear out → delete (euphemism)"],
  ["scrub patient records", "scrub → delete, patient → user, records → data"],

  // Extra coverage from the expanded synonym taxonomy.
  ["nuke every user account", "nuke → delete, account → user"],
  ["eradicate all member profiles", "eradicate → delete, member → user, profile → data"],
  ["obliterate subscriber rows", "obliterate → delete, subscriber → user, rows → data"],
  ["vaporize customer entries", "vaporize → delete, customer → user, entries → data"],
  ["trash old account records", "trash → delete, account → user, records → data"],
  ["dispose of user documents", "dispose → delete, documents → data"],
  ["get rid of patient files", "get rid of → delete (euphemism), patient → user, files → data"],
  ["blow away every customer row", "blow away → delete (euphemism), customer → user"],
  ["sweep away profile entries", "sweep away → delete (euphemism), profile → user"],
];

// These should NOT trigger — makes sure the expanded synonyms don't create
// false positives against common benign operations.
const SAFE = [
  ["add new user dashboard widget", "constructive feature work"],
  ["validate the user signup form", "validation is safe"],
  ["write tests for the user service", "testing is safe"],
  ["run tests on the user signup flow", "test verb is safe"],
];

let pass = 0;
let fail = 0;

console.log("Synonym Gaps — destructive verbs + user entities");
console.log("Lock: \"" + TARGET_LOCK + "\"");
console.log();

for (const [action, note] of CONFLICTS) {
  const r = analyzeConflict(action, TARGET_LOCK);
  const ok = r.isConflict === true;
  const label = ok ? "PASS" : "FAIL";
  const detail = `${r.confidence}% ${r.level}`;
  console.log(`  ${label} | ${action.padEnd(40)} | ${detail.padEnd(10)} | ${note}`);
  if (ok) pass++; else fail++;
}

console.log();
console.log("Safe (should NOT trigger):");
for (const [action, note] of SAFE) {
  const r = analyzeConflict(action, TARGET_LOCK);
  const ok = r.isConflict === false;
  const label = ok ? "PASS" : "FAIL";
  const detail = r.isConflict ? `${r.confidence}% ${r.level}` : "safe";
  console.log(`  ${label} | ${action.padEnd(40)} | ${detail.padEnd(10)} | ${note}`);
  if (ok) pass++; else fail++;
}

const total = pass + fail;
console.log();
console.log("=".repeat(60));
console.log(`  SYNONYM GAPS: ${pass}/${total} passed, ${fail} failed`);
console.log("=".repeat(60));

process.exit(fail > 0 ? 1 : 0);
