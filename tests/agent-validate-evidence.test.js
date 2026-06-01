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

console.log('agent-validate-evidence.test.js passed');
