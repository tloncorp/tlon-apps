import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifySetupPlan,
  requiresBackend,
  verifyDisposableBackend,
} from './fixtures.mjs';
import { backendInstructions } from './codex.mjs';
import { verifyPeer } from './ship-proxy.mjs';
const plan = {
  headSha: 'a'.repeat(40),
  setup: { fixtures: ['chat-v1'] },
  scenarios: [{ fixture: 'chat-v1', method: 'simulator', regression: 'none' }],
};
test('simulator checks without seeded data still get an isolated backend', () => {
  const settings = {
    decision: 'test',
    setup: { fixtures: [] },
    scenarios: [{ method: 'simulator', fixture: 'none', regression: 'none' }],
  };
  assert.equal(verifySetupPlan(settings), settings);
  assert.equal(requiresBackend(settings), true);
  const context = {
    testShip: '~zod',
    assessment: settings,
    backend: { fixtures: [] },
  };
  assert.doesNotThrow(() => verifyDisposableBackend(context, true));
  assert.throws(
    () => verifyDisposableBackend({ ...context, testShip: '~ten' }, true),
    /requires ~zod/
  );
  assert.throws(
    () =>
      verifyDisposableBackend(
        { ...context, assessment: { ...settings, setup: null } },
        true
      ),
    /known fixture/
  );
  const instructions = backendInstructions(context, {
    QA_RUN_TAG: 'settings-test',
  });
  assert.match(instructions, /Create the ordinary test data/);
  assert.match(instructions, /exercise relevant account settings/i);
  assert.doesNotMatch(instructions, /reply received|from mobile/);
  assert.match(
    backendInstructions({ backend: {} }, { QA_RUN_TAG: 'manual' }),
    /manual reply received/
  );
  assert.equal(requiresBackend(plan), true);
  assert.equal(
    requiresBackend({ ...settings, scenarios: [{ method: 'unavailable' }] }),
    false
  );
  assert.equal(
    requiresBackend({ ...settings, decision: 'skip', scenarios: [] }),
    false
  );
});
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
    group: { groupId: '~zod/cloud-test-1', chatChannel: 'chat/~zod/test' },
    deskHashes: ['hash', 'hash'],
    fixtureVerified: true,
    fixtures: [
      {
        recipe: 'chat-v1',
        verified: true,
        groupId: '~zod/cloud-test-1',
        channelId: 'chat/~zod/test',
        peerMessage: 'test from ten',
        peerMessageVerified: true,
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

test('pilot rejects regression plans on the runner path that cannot execute them', () => {
  const regression = {
    method: 'regression',
    fixture: 'none',
    regression: 'reply-snapshot',
  };
  const noShips = { setup: { fixtures: [] }, scenarios: [regression] };
  assert.throws(
    () => verifySetupPlan(noShips),
    /require the disposable-fixture runner/
  );
  assert.throws(
    () =>
      verifySetupPlan({
        ...noShips,
        scenarios: [
          ...noShips.scenarios,
          { method: 'simulator', fixture: 'none', regression: 'none' },
        ],
      }),
    /require the disposable-fixture runner/
  );
  assert.equal(
    verifySetupPlan({ ...plan, scenarios: [...plan.scenarios, regression] })
      .scenarios.length,
    2
  );
});
