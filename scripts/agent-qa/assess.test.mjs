import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyAssessment,
  assessmentArgs,
  verifySourceOverlay,
  comparisonBase,
  prepareSourceCheckout,
} from './assess.mjs';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
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

const plan = {
  decision: 'test',
  reason: 'Changes editing',
  scopeNotes: [],
  scenarios: [
    { steps: ['Edit and save a note'], expected: 'The edited text persists' },
  ],
};
test('assessment is a bounded exploration plan, without fixture or coverage contracts', () => {
  const checked = verifyAssessment(plan);
  assert.deepEqual(checked.scenarios, [{ ...plan.scenarios[0], id: 'path-1' }]);
  assert.throws(
    () => verifyAssessment({ ...plan, scenarios: [] }),
    /exploration plan/
  );
  assert.throws(
    () => verifyAssessment({ ...plan, decision: 'skip' }),
    /exploration plan/
  );
  assert.equal(
    verifyAssessment({ ...plan, decision: 'skip', scenarios: [] }).decision,
    'skip'
  );
  assert.equal(
    verifyAssessment({ ...plan, decision: 'blocked', scenarios: [] }).decision,
    'blocked'
  );
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
    const checkout = path.join(dir, 'review-source');
    prepareSourceCheckout(checkout, head);
    assert.equal(
      readFileSync(path.join(checkout, 'app.txt'), 'utf8'),
      'PR change'
    );
    assert.equal(
      git('rev-parse', 'HEAD'),
      baseTip,
      'original checkout stays on its own branch'
    );
  } finally {
    process.chdir(before);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assessment has no device MCP tools and uses an normal read-only Codex shell', () => {
  const args = assessmentArgs({
    cwd: '/tmp/work',
    schema: '/tmp/schema',
    output: '/tmp/result',
    instructions: 'Assess',
  });
  assert.equal(
    args.some((arg) => arg.includes('mcp_servers.device')),
    false
  );
  assert.ok(args.includes('features.shell_tool=true'));
  assert.ok(!args.some((arg) => arg.includes('mcp_servers.')));
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('read-only'));
});
