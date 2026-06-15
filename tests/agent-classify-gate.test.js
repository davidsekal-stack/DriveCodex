import assert from 'node:assert/strict';
import { isClassifierApproved } from '../scripts/agent/classify.mjs';

// This test LOCKS the strict quality floor for the autonomous crawler's
// classifier gate. The dominant volume loss is threads with a fault but no
// owner-confirmed fix; admitting those ("expert-consensus tier") is a deliberate
// product decision that must change this gate EXPLICITLY and in lockstep with
// the extractor + validate same-author gate. If a future edit silently relaxes
// any of these flags, this test must fail so the change is caught in review.

const fullyApproved = {
  should_seed: true,
  is_relevant: true,
  has_explicit_fault: true,
  has_confirmed_resolution: true,
  same_user_confirms_resolution: true,
  evidence_post_numbers: [1, 3],
};
assert.equal(isClassifierApproved(fullyApproved), true, 'all gates true → approved');

// Each individual gate is required.
const requiredFlags = [
  'should_seed',
  'is_relevant',
  'has_explicit_fault',
  'has_confirmed_resolution',
  'same_user_confirms_resolution',
];
for (const flag of requiredFlags) {
  const r = { ...fullyApproved, [flag]: false };
  assert.equal(isClassifierApproved(r), false, `${flag}=false → rejected`);
}

// The same-user confirmation requirement specifically: a fault described by one
// user and a fix suggested by another (no owner confirmation) must NOT pass the
// strict gate today.
assert.equal(
  isClassifierApproved({ ...fullyApproved, same_user_confirms_resolution: false }),
  false,
  'expert-consensus (different author, no OP confirmation) is rejected by strict gate',
);

// Evidence posts are mandatory.
assert.equal(isClassifierApproved({ ...fullyApproved, evidence_post_numbers: [] }), false, 'no evidence → rejected');
assert.equal(isClassifierApproved({ ...fullyApproved, evidence_post_numbers: undefined }), false, 'missing evidence → rejected');

// Null / malformed input defaults to rejection.
assert.equal(isClassifierApproved(null), false, 'null → rejected');
assert.equal(isClassifierApproved({}), false, 'empty → rejected');

console.log('agent-classify-gate.test.js passed');
