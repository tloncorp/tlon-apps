import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { backendProofServer, liveBackendProof } from './backend-proof.mjs';
import { verifyCompletionNonce } from './ship-proxy.mjs';
const evidence = {
  deskHashes: ['hash', 'hash'],
  group: { groupId: 'fixture' },
};
const nonce = '11111111-1111-4111-8111-111111111111';
test('completion requires live matching responses and the post-test nonce', async () => {
  let calls = 0;
  const proof = await liveBackendProof(evidence, nonce, async () => {
    calls++;
    return ['hash', 'hash'];
  });
  assert.equal(calls, 1);
  assert.equal(verifyCompletionNonce(proof, nonce), proof);
  assert.throws(
    () => verifyCompletionNonce({ ...evidence, fixtureVerified: true }, nonce),
    /not fresh/
  );
  assert.throws(() => verifyCompletionNonce(proof, 'different'), /not fresh/);
  await assert.rejects(
    liveBackendProof(evidence, nonce, async () => ['hash', 'changed']),
    /verification failed/
  );
  await assert.rejects(
    liveBackendProof(evidence, nonce, async () => {
      throw Error('ship stopped');
    }),
    /ship stopped/
  );
});
test('an alive proof proxy cannot serve a stale success after a ship stops', async () => {
  let alive = true,
    persisted = [];
  const server = backendProofServer({
    evidence,
    readDeskHashes: async () => {
      if (!alive) throw Error('offline');
      return ['hash', 'hash'];
    },
    persist: (p) => persisted.push(p),
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/result?nonce=${nonce}`;
  try {
    assert.equal(persisted.length, 0);
    const first = await fetch(url);
    assert.equal(first.status, 200);
    verifyCompletionNonce(await first.json(), nonce);
    alive = false;
    const second = await fetch(url);
    assert.equal(second.status, 503);
    assert.equal(persisted.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
