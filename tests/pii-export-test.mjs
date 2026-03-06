import { analyzeConflict } from '../src/core/semantics.js';

const tests = [
  ['Export SSNs to a spreadsheet', 'Never expose PII or personal data', true],
  ['Export user social security numbers', 'Never expose personally identifiable information', true],
  ['Make the data public for analytics', 'Never expose user data through the API', true],
  ['Include email address in the API response', 'Never expose user email addresses through the API', true],
  ['Update the user profile endpoint to include name, avatar, and email address in the response', 'Never expose user email addresses through the API', true],
  // False positives
  ['Add dark mode', 'Never expose user data', false],
  ['Fix the login page', 'Never expose PII', false],
  ['Add a search bar', 'Never expose personal data', false],
];

let pass = 0, fail = 0;
for (const [action, lock, expected] of tests) {
  const r = analyzeConflict(action, lock);
  const ok = r.isConflict === expected;
  const label = ok ? 'PASS' : 'FAIL';
  const detail = r.isConflict ? `${r.confidence}% ${r.level}` : 'safe';
  console.log(`${label} | ${action.substring(0, 65).padEnd(65)} | ${detail}`);
  if (!ok) {
    console.log(`  Expected: ${expected}, Got: ${r.isConflict}`);
    console.log(`  Reasons: ${r.reasons.join(' | ')}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n========================================`);
console.log(`  PII/EXPORT: ${pass}/${pass + fail} passed, ${fail} failed`);
console.log(`========================================`);

process.exit(fail > 0 ? 1 : 0);
