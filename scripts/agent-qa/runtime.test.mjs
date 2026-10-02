import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyRuntime } from './runtime.mjs';

test('a cached runtime cannot silently differ from the pinned binary', () => {
  const binary = Buffer.from('pinned runtime');
  const expected = createHash('sha256').update(binary).digest('hex');
  assert.equal(verifyRuntime(binary, expected), expected);
  assert.throws(
    () => verifyRuntime(Buffer.from('old runtime'), expected),
    /checksum mismatch/
  );
  assert.throws(
    () => verifyRuntime(Buffer.from('truncated'), expected),
    /checksum mismatch/
  );
});
