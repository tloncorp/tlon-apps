import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySetupPlan } from './fixtures.mjs';
import { verifyPeer } from './ship-proxy.mjs';
const plan = {
  headSha: 'a'.repeat(40),
  setup: { fixtures: ['notes-v1'] },
  scenarios: [{ fixture: 'notes-v1', method: 'simulator', regression: 'none' }],
};
test('assessment selects reviewed setup and test recipes, never executable model commands', () => {
  assert.equal(verifySetupPlan(plan), plan);
  assert.throws(
    () =>
      verifySetupPlan({
        ...plan,
        setup: { fixtures: ['run arbitrary shell'] },
      }),
    /known fixture/
  );
  assert.throws(
    () => verifySetupPlan({ ...plan, setup: { fixtures: [] } }),
    /not requested/
  );
  assert.throws(
    () =>
      verifySetupPlan({
        ...plan,
        scenarios: [
          { method: 'regression', fixture: 'none', regression: 'arbitrary' },
        ],
      }),
    /Unknown regression/
  );
});
test('fixture gate requires authoritative matching readiness before device setup', () => {
  const proof = {
    source: 'a'.repeat(40),
    group: { groupId: '~zod/cloud-test-1' },
    deskHashes: ['hash', 'hash'],
    fixtureVerified: true,
    fixtures: [
      {
        recipe: 'notes-v1',
        verified: true,
        groupId: '~zod/cloud-test-1',
        channelId: 'notes/~zod/test',
        noteCount: 14,
        searchVerified: true,
        writable: true,
      },
    ],
    regressionResults: [
      { id: 'reply-snapshot', source: plan.headSha, status: 'passed' },
    ],
  };
  assert.equal(verifyPeer(proof, plan.headSha, 'test', true, plan), proof);
  assert.throws(
    () =>
      verifyPeer({ ...proof, fixtures: [] }, plan.headSha, 'test', true, plan),
    /not provisioned/
  );
  assert.throws(
    () =>
      verifyPeer(
        { ...proof, regressionResults: [{ source: 'b'.repeat(40) }] },
        plan.headSha,
        'test',
        true,
        plan
      ),
    /source mismatch/
  );
  assert.throws(
    () =>
      verifyPeer(
        { ...proof, fixtureVerified: false },
        plan.headSha,
        'test',
        true,
        plan
      ),
    /does not match/
  );
});

test('chat fixture requires matching chat identity and verified peer message', () => {
  const chatPlan = {
    headSha: plan.headSha,
    setup: { fixtures: ['chat-v1'] },
    scenarios: [
      { fixture: 'chat-v1', method: 'simulator', regression: 'none' },
    ],
  };
  verifySetupPlan(chatPlan);
  const proof = {
    source: plan.headSha,
    group: { groupId: '~zod/cloud-test-1', chatChannel: 'chat/~zod/qa' },
    deskHashes: ['hash', 'hash'],
    fixtureVerified: true,
    fixtures: [
      {
        recipe: 'chat-v1',
        verified: true,
        writable: true,
        groupId: '~zod/cloud-test-1',
        channelId: 'chat/~zod/qa',
        peerMessage: 'test from ten',
        peerMessageVerified: true,
      },
    ],
  };
  assert.equal(verifyPeer(proof, plan.headSha, 'test', true, chatPlan), proof);
  for (const patch of [
    { channelId: 'chat/~zod/other' },
    { peerMessageVerified: false },
    { peerMessage: 'old from ten' },
  ]) {
    assert.throws(
      () =>
        verifyPeer(
          { ...proof, fixtures: [{ ...proof.fixtures[0], ...patch }] },
          plan.headSha,
          'test',
          true,
          chatPlan
        ),
      /not provisioned/
    );
  }
});
