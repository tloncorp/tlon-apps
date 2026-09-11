import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPeer, connectShips } from './ship-proxy.mjs';
const sha = 'a'.repeat(40);
const proof = {
  source: sha,
  group: { groupId: '~zod/cloud-ci123-fixture' },
  deskHashes: ['hash', 'hash'],
  replyVerified: true,
};
test('peer receipt must match the requested revision and unique fixture', () => {
  assert.equal(verifyPeer(proof, sha, 'ci123', true), proof);
  for (const invalid of [
    { ...proof, source: 'b'.repeat(40) },
    { ...proof, group: { groupId: '~zod/cloud-ci12-fixture' } },
    { ...proof, deskHashes: ['a', 'b'] },
    { ...proof, replyVerified: false },
  ]) {
    assert.throws(() => verifyPeer(invalid, sha, 'ci123', true));
  }
});
test('tunnel credentials cannot be forwarded to arbitrary destinations', async () => {
  for (const url of [
    'http://test.ngrok.app',
    'https://example.com',
    'https://test.ngrok.app.evil.com',
    'https://test.ngrok.app/path',
  ]) {
    await assert.rejects(
      connectShips({ QA_SHIP_URL: url, QA_TUNNEL_TOKEN: 'a'.repeat(64) })
    );
  }
});
