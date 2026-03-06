import { analyzeConflict } from '../src/core/semantics.js';

const tests = [
  // Claude's Suite D failures
  ['Should we add Razorpay for Indian payments?', 'Never change the Stripe integration', true],
  ['Would Firebase be better for real-time sync?', 'Never change database from PostgreSQL', true],
  ['Would it make sense to migrate to Firebase?', 'Never change database from PostgreSQL', true],
  // Claude's Suite C failures
  ['Transition the database layer to use MongoDB', 'Never change database from PostgreSQL', true],
  ['I was wondering if we could use MongoDB instead?', 'Never change database from PostgreSQL', true],
  ['What if we used Firebase for real-time features?', 'Never change database from PostgreSQL', true],
  // Should still work
  ['Could we possibly switch to MongoDB?', 'Never change database from PostgreSQL', true],
  // False positives - should NOT trigger
  ['Should we add dark mode?', 'Never change the Stripe integration', false],
  ['What if we changed the font?', 'Never modify the authentication system', false],
];

let pass = 0, fail = 0;
for (const [action, lock, expected] of tests) {
  const r = analyzeConflict(action, lock);
  const ok = r.isConflict === expected;
  const label = ok ? 'PASS' : 'FAIL';
  const detail = r.isConflict ? `${r.confidence}% ${r.level}` : 'safe';
  console.log(`${label} | ${action.substring(0, 55).padEnd(55)} | ${detail}`);
  if (!ok) {
    console.log(`  Expected: ${expected}, Got: ${r.isConflict}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n========================================`);
console.log(`  QUESTION FRAMING: ${pass}/${pass + fail} passed, ${fail} failed`);
console.log(`========================================`);

process.exit(fail > 0 ? 1 : 0);
