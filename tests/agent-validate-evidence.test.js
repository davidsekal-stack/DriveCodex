import assert from 'node:assert/strict';
import { validateCase } from '../scripts/agent/validate.mjs';

const threadText = `
THREAD_URL: https://example.com/viewtopic.php?t=100
TITLE: Sample thread
THREAD_AUTHOR: Alice

POST 1 | page: 1 | author: Alice | is_thread_author: true:
The engine stalled while driving and the tachometer dropped to zero.

POST 2 | page: 1 | author: Alice | is_thread_author: true:
The crankshaft sensor was replaced and the car has been fine since then.
`.trim();

const result = validateCase({
  case_author: 'Alice',
  fault_post_numbers: [99],
  resolution_post_numbers: [2],
  brand_raw: 'Kia',
  model_raw: 'Ceed',
  symptoms: ['engine stalls'],
  description: 'The engine stalled while driving and the tachometer dropped to zero.',
  resolution: 'The crankshaft position sensor was replaced and the issue did not return.',
}, { threadText });

assert.equal(result.valid, false);
assert.match(result.reason, /Fault post 99 not found in thread/);

// ── Owner policy: the RESOLUTION may be posted by a DIFFERENT user ──────────────
// Fault described by the owner (Alice), fix posted by a helper (Bob) → VALID.
const helperThread = `
THREAD_URL: https://example.com/viewtopic.php?t=200
TITLE: Helper fixes it
THREAD_AUTHOR: Alice

POST 1 | page: 1 | author: Alice | is_thread_author: true:
My Kia Ceed engine stalls while driving and the tachometer drops to zero.

POST 2 | page: 1 | author: Bob | is_thread_author: false:
Replace the crankshaft position sensor — that fixed mine and a few others here.

POST 3 | page: 1 | author: Alice | is_thread_author: true:
Replaced the crankshaft sensor as Bob suggested and the problem is gone, thanks.
`.trim();

const baseCase = {
  case_author: 'Alice',
  brand_raw: 'Kia', model_raw: 'Ceed',
  symptoms: ['engine stalls'],
  description: 'The engine stalled while driving and the tachometer dropped to zero.',
  resolution: 'The crankshaft position sensor was replaced and the issue did not return.',
};

const helperOk = validateCase(
  { ...baseCase, fault_post_numbers: [1], resolution_post_numbers: [2] }, // resolution by Bob
  { threadText: helperThread },
);
assert.equal(helperOk.valid, true, 'resolution posted by a different user (helper) is now valid');

// But the FAULT post must still be the owner's — fault post by Bob breaks the anchor.
const wrongFault = validateCase(
  { ...baseCase, fault_post_numbers: [2], resolution_post_numbers: [3] }, // fault by Bob
  { threadText: helperThread },
);
assert.equal(wrongFault.valid, false, 'fault post by a different author still fails (vehicle anchor)');
assert.match(wrongFault.reason, /Fault post 2 author mismatch/);

// ── Vehicle-bleed guard: model lifted from a helper's resolution post ──────────
// Owner (Alice) never names the car; the A6 comes only from helper Bob's post →
// the case must NOT bind to the wrong vehicle.
const bleedThread = `
THREAD_URL: https://example.com/viewtopic.php?t=300
TITLE: stalling issue
THREAD_AUTHOR: Alice

POST 1 | page: 1 | author: Alice | is_thread_author: true:
My car stalls while driving and the tachometer drops to zero.

POST 2 | page: 1 | author: Bob | is_thread_author: false:
On my Audi A6 3.0 TDI the crankshaft sensor did exactly this — replace it.

POST 3 | page: 1 | author: Alice | is_thread_author: true:
Replaced the crankshaft sensor, problem gone, thanks.
`.trim();

const bleed = validateCase(
  { ...baseCase, brand_raw: 'Audi', model_raw: 'A6', fault_post_numbers: [1], resolution_post_numbers: [2] },
  { threadText: bleedThread },
);
assert.equal(bleed.valid, false, 'vehicle present only in a helper resolution post is rejected (bleed)');
assert.match(bleed.reason, /wrong-vehicle bleed|only in a different author/i);

// But when the owner DOES name the car (helper merely confirms), it is fine.
const groundedThread = bleedThread.replace(
  'My car stalls while driving',
  'My Audi A6 3.0 TDI stalls while driving',
);
const grounded = validateCase(
  { ...baseCase, brand_raw: 'Audi', model_raw: 'A6', fault_post_numbers: [1], resolution_post_numbers: [2] },
  { threadText: groundedThread },
);
assert.equal(grounded.valid, true, 'vehicle named in the owner fault post is grounded → valid');

console.log('agent-validate-evidence.test.js passed');
