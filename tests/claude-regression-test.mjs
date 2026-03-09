import { analyzeConflict } from '../src/core/semantics.js';

console.log("=== CLAUDE REGRESSIONS (should BLOCK) ===\n");

const regressions = [
  ['Rewrite the UI in Vue 3 for better performance', 'Never change the frontend framework — we use React'],
  ['How hard would it be to rewrite this in Vue?', 'Never change the frontend framework — we use React'],
  ['What if we used SvelteKit for the new features?', 'Never change the frontend framework — we use React'],
];

let regPass = 0;
for (const [action, lock] of regressions) {
  const r = analyzeConflict(action, lock);
  const ok = r.isConflict;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} (${r.confidence}%) ${action}`);
  if (r.reasons && r.reasons.length > 0) {
    console.log(`    Reasons: ${r.reasons.slice(0, 3).join('; ')}`);
  }
  if (ok) regPass++;
}
console.log(`\nRegressions: ${regPass}/${regressions.length} caught\n`);

console.log("=== FALSE POSITIVES (should ALLOW) ===\n");

const falsePositives = [
  ['Write unit tests for payment module', 'Never touch the Razorpay integration'],
  ['Update Supabase client library version', 'Never modify the database schema directly'],
  ['Optimize Supabase query performance', 'Never modify the database schema directly'],
  ['Write integration tests for Supabase schema', 'Never modify the database schema directly'],
  ['Add input validation to login form', 'Never modify authentication files without security review'],
  ['Write tests for auth token refresh logic', 'Never modify authentication files without security review'],
];

let fpPass = 0;
for (const [action, lock] of falsePositives) {
  const r = analyzeConflict(action, lock);
  const ok = !r.isConflict;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} (${r.confidence}%) ${action}`);
  if (r.reasons && r.reasons.length > 0) {
    console.log(`    Reasons: ${r.reasons.slice(0, 3).join('; ')}`);
  }
  if (ok) fpPass++;
}
console.log(`\nFalse positives: ${fpPass}/${falsePositives.length} correct\n`);

console.log(`TOTAL: ${regPass + fpPass}/${regressions.length + falsePositives.length}`);
