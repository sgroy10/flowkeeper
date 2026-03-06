import { analyzeConflict } from '../src/core/semantics.js';

const tests = [
  // Payment provider brand names
  ['Add Razorpay as payment gateway', 'Never change the payment gateway configuration', true],
  ['Add PhonePe as payment provider', 'Never change the payment gateway configuration', true],
  ['Integrate CCAvenue for payments', 'Payment processing must not be modified', true],
  ['Add Paytm UPI integration', 'Payment gateway must not be changed', true],
  ['Switch to PayPal for checkout', 'Never modify the payment system', true],
  ['Add Stripe webhook handler', 'Payment processing must not be modified', true],

  // Salary/payroll
  ['optimize salary calculations', 'Payroll records must not be changed or processed outside authorized systems', true],
  ['Recalculate payroll deductions', 'Salary data must never be modified without approval', true],
  ['Backdate the wage entries', 'Compensation records must not be altered', true],

  // False positive checks
  ['Change the font on the login page', 'Never modify the authentication system', false],
  ['Fix login page styling', 'Authentication flow must not be changed', false],
  ['Add a search bar to the homepage', 'Database schema must not be modified', false],
  ['Update the README file', 'Payment gateway must not be changed', false],
  ['Add a new color theme', 'Never modify user authentication', false],

  // Should still work
  ['Delete patient records', 'Patient records must never be deleted', true],
  ['Disable 2FA temporarily', 'Two-factor authentication must remain enabled', true],
  ['Truncate the audit log table', 'Audit logs must never be deleted or modified', true],
  ['Reconcile the account balances', 'Financial records must not be altered', true],
];

let pass = 0, fail = 0;
for (const [action, lock, expected] of tests) {
  const r = analyzeConflict(action, lock);
  const ok = r.isConflict === expected;
  const label = ok ? 'PASS' : 'FAIL';
  const detail = r.isConflict ? `${r.confidence}% ${r.level}` : 'safe';
  console.log(`${label} | ${action.substring(0, 50).padEnd(50)} | ${detail}`);
  if (!ok) {
    console.log(`  Expected: ${expected}, Got: ${r.isConflict}, Score: ${r.confidence}`);
    console.log(`  Reasons: ${r.reasons.slice(0, 3).join('; ')}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n========================================`);
console.log(`  PAYMENT/SALARY: ${pass}/${pass + fail} passed, ${fail} failed`);
console.log(`========================================`);

process.exit(fail > 0 ? 1 : 0);
