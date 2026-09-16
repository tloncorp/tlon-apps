import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyAssessment,
  verifyCoverage,
  assessmentArgs,
  verifySourceOverlay,
  comparisonBase,
} from './assess.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('QA overlay accepts tooling only and refuses altered product source', () => {
  const before = process.cwd();
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-source-test-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init');
    git('config', 'user.email', 'qa@example.invalid');
    git('config', 'user.name', 'QA');
    writeFileSync(path.join(dir, 'app.txt'), 'original');
    git('add', '.');
    git('commit', '-m', 'source');
    const head = git('rev-parse', 'HEAD');
    git('remote', 'add', 'origin', dir);
    mkdirSync(path.join(dir, 'scripts/agent-qa'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts/agent-qa/test.mjs'), '// harness');
    git('add', '.');
    git('commit', '-m', 'qa');
    const builtOverlay = git('rev-parse', 'HEAD');
    process.chdir(dir);
    assert.doesNotThrow(() => verifySourceOverlay(head));
    writeFileSync(
      path.join(dir, 'scripts/agent-qa/test.mjs'),
      '// fixed harness'
    );
    git('add', '.');
    git('commit', '--amend', '--no-edit');
    assert.doesNotThrow(() => verifySourceOverlay(head));
    assert.doesNotThrow(() => verifySourceOverlay(head, builtOverlay));
    writeFileSync(path.join(dir, 'app.txt'), 'changed');
    git('add', '.');
    git('commit', '--amend', '--no-edit');
    assert.throws(() => verifySourceOverlay(head), /changes product source/);
    assert.throws(
      () => verifySourceOverlay(head, git('rev-parse', 'HEAD')),
      /changes product source/
    );
    assert.throws(
      () => verifySourceOverlay(head, '--bad-ref'),
      /Invalid QA overlay/
    );
    assert.doesNotThrow(() => verifySourceOverlay(git('rev-parse', 'HEAD')));
    git('commit', '--allow-empty', '-m', 'grandchild');
    assert.throws(() => verifySourceOverlay(head), /direct child/);
  } finally {
    process.chdir(before);
    rmSync(dir, { recursive: true, force: true });
  }
});

const files = ['packages/app/features/chat/Chat.tsx'];
const scenario = {
  id: 'change-1',
  change: 'Show send failure',
  files,
  steps: ['Open a test conversation', 'Attempt a send while offline'],
  expected: 'The message shows an error and retry action',
  prerequisites: 'Isolated writable account and network control',
  method: 'simulator',
  fixture: 'none',
  regression: 'none',
};
const plan = {
  decision: 'test',
  setup: { fixtures: [] },
  reason: 'Changes send failure behavior',
  changes: [scenario.change],
  scenarios: [scenario],
};

test('all declared changes have scenarios and scenarios cannot invent an unrelated change', () => {
  assert.throws(
    () =>
      verifyAssessment(
        { ...plan, changes: [scenario.change, 'New navigation'] },
        files
      ),
    /Every assessed change/
  );
  assert.throws(
    () =>
      verifyAssessment(
        { ...plan, scenarios: [{ ...scenario, change: 'Unrelated smoke' }] },
        files
      ),
    /Scenario/
  );
  const covered = {
    ...plan,
    changes: [scenario.change, 'New navigation'],
    scenarios: [
      scenario,
      {
        ...scenario,
        id: 'change-2',
        change: 'New navigation',
        method: 'unavailable',
      },
    ],
  };
  assert.equal(verifyAssessment(covered, files), covered);
});

test('plans with only unavailable checks preserve capability gaps without leasing devices', () => {
  const unavailable = {
    ...plan,
    scenarios: [
      { ...scenario, method: 'unavailable', prerequisites: 'Needs Android' },
    ],
  };
  const checked = verifyAssessment(unavailable, files);
  assert.equal(checked.decision, 'blocked');
  assert.equal(checked.scenarios[0].prerequisites, 'Needs Android');
  assert.match(checked.reason, /No executable simulator/);
  assert.equal(verifyAssessment(plan, files).decision, 'test');
});

test('advanced target-branch changes do not become the before-side of a PR review', () => {
  const before = process.cwd();
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-merge-base-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init');
    git('config', 'user.email', 'qa@example.invalid');
    git('config', 'user.name', 'QA');
    writeFileSync(path.join(dir, 'app.txt'), 'original');
    git('add', '.');
    git('commit', '-m', 'shared');
    const shared = git('rev-parse', 'HEAD');
    writeFileSync(path.join(dir, 'app.txt'), 'PR change');
    git('commit', '-am', 'head');
    const head = git('rev-parse', 'HEAD');
    git('checkout', '--detach', shared);
    writeFileSync(path.join(dir, 'app.txt'), 'unrelated target change');
    git('commit', '-am', 'base advanced');
    const baseTip = git('rev-parse', 'HEAD');
    process.chdir(dir);
    assert.equal(comparisonBase(baseTip, head), shared);
    assert.notEqual(comparisonBase(baseTip, head), baseTip);
  } finally {
    process.chdir(before);
    rmSync(dir, { recursive: true, force: true });
  }
});

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
        setup: { fixtures: [] },
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
        expected: scenario.expected,
        status: 'blocked',
        observed: 'No writable fixture',
      },
    ],
  };
  assert.equal(verifyCoverage(blocked, plan), blocked);
  assert.throws(
    () =>
      verifyCoverage(
        {
          checks: [
            { ...blocked.checks[0], expected: 'Home loads', status: 'passed' },
          ],
        },
        plan
      ),
    /acceptance criterion/
  );
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

// Prevent the contradictory timing prerequisite that previously blocked brief UI states.
test('planner tries captured transient states before requiring timing controls', async () => {
  const { assessmentInstructions } = await import('./assess.mjs');
  assert.match(
    assessmentInstructions,
    /plan a normal recorded interaction first/
  );
  assert.match(
    assessmentInstructions,
    /controlled timing is a follow-up only if the recorded state is absent or illegible/
  );
  assert.doesNotMatch(
    assessmentInstructions,
    /Transient states require an explicit timing-control prerequisite/
  );
});

import { appendInfrastructureFailure, verifyReport } from './core.mjs';

test('infrastructure loss survives full report validation without satisfying coverage', () => {
  const result = appendInfrastructureFailure(
    {
      status: 'failed',
      summary: 'Reproduced',
      checks: [
        {
          scenarioId: scenario.id,
          expected: scenario.expected,
          observed: 'Failure observed',
          status: 'failed',
          evidence: ['capture'],
        },
      ],
    },
    'Backend verification failed'
  );
  assert.equal(
    verifyCoverage(verifyReport(result, new Map([['capture', {}]])), plan),
    result
  );
  assert.equal(result.status, 'failed');
  assert.throws(
    () => verifyCoverage({ ...result, checks: [result.checks.at(-1)] }, plan),
    /not accounted for/
  );
  assert.throws(
    () =>
      verifyCoverage(
        { ...result, checks: [{ ...result.checks.at(-1), status: 'passed' }] },
        plan
      ),
    /Invalid infrastructure/
  );
});
