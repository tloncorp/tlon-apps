import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAssessment, verifyCoverage, assessmentArgs } from './assess.mjs';

const files = ['packages/app/features/chat/Chat.tsx'];
const scenario = {
  id: 'change-1',
  change: 'Show send failure',
  files,
  steps: ['Open a test conversation', 'Attempt a send while offline'],
  expected: 'The message shows an error and retry action',
  prerequisites: 'Isolated writable account and network control',
};
const plan = {
  decision: 'test',
  reason: 'Changes send failure behavior',
  changes: ['Send failure handling'],
  scenarios: [scenario],
};

test('assessment requires traceable behavioral scenarios and cannot skip known user-facing changes', () => {
  assert.equal(verifyAssessment(plan, files), plan);
  assert.throws(
    () => verifyAssessment({ ...plan, decision: 'skip' }, files),
    /silently skipped/
  );
  assert.throws(
    () => verifyAssessment({ ...plan, scenarios: [] }, files),
    /requires/
  );
  assert.throws(() => verifyAssessment(plan, ['README.md']), /changed file/);
  assert.throws(
    () => verifyAssessment({ ...plan, scenarios: [scenario, scenario] }, files),
    /Scenario/
  );
  assert.equal(
    verifyAssessment(
      {
        decision: 'skip',
        reason: 'Documentation only',
        changes: [],
        scenarios: [],
      },
      ['README.md']
    ).decision,
    'skip'
  );
  assert.equal(
    verifyAssessment(
      { ...plan, decision: 'blocked', reason: 'No isolated account' },
      files
    ).decision,
    'blocked'
  );
});

test('generic smoke success or omitted PR changes cannot satisfy the assessment', () => {
  assert.throws(
    () =>
      verifyCoverage(
        { checks: [{ expected: 'Home loads', status: 'passed' }] },
        plan
      ),
    /does not correspond/
  );
  assert.throws(
    () => verifyCoverage({ checks: [] }, plan),
    /not accounted for/
  );
  const blocked = {
    checks: [
      {
        scenarioId: 'change-1',
        status: 'blocked',
        observed: 'No writable fixture',
      },
    ],
  };
  assert.equal(verifyCoverage(blocked, plan), blocked);
});

test('assessment has no device MCP tools and uses an isolated read-only Codex session', () => {
  const args = assessmentArgs({
    cwd: '/tmp/work',
    schema: '/tmp/schema',
    output: '/tmp/result',
    instructions: 'Assess',
  });
  assert.equal(
    args.some((arg) => arg.includes('mcp_servers')),
    false
  );
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('read-only'));
});
