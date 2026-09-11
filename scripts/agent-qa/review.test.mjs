import { verifyReport } from './core.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { sourceReader, evidenceCall, readActions } from './review-tools.mjs';
import {
  verifySourceReview,
  reviewArgs,
  verifyDiscoveries,
} from './review.mjs';
import { verifyAssessment } from './assess.mjs';

test('blind review reads pinned versions and callers, rejects invented citations and local files', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'qa-review-test-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'qa@example.invalid');
    git('config', 'user.name', 'QA');
    writeFileSync(
      path.join(repo, 'consumer.ts'),
      'export const consume = items => items;\n'
    );
    writeFileSync(path.join(repo, 'caller.ts'), 'consume(uniqueItems);\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(
      path.join(repo, 'consumer.ts'),
      'export const consume = items => items.concat(items);\n'
    );
    mkdirSync(path.join(repo, 'scripts/agent-qa'), { recursive: true });
    writeFileSync(
      path.join(repo, 'scripts/agent-qa/known-findings.md'),
      'external answer'
    );
    git('add', '.');
    git('commit', '-qm', 'head');
    const head = git('rev-parse', 'HEAD');
    writeFileSync(path.join(repo, 'caller.ts'), 'uncommitted content');
    const reader = sourceReader({ repo, base, head });
    assert.match(
      reader.call('read_source', {
        version: 'head',
        file: 'caller.ts',
        start: 1,
        limit: 10,
      }).text,
      /consume\(uniqueItems\)/
    );
    assert.match(
      reader.call('read_source', {
        version: 'base',
        file: 'consumer.ts',
        start: 1,
        limit: 10,
      }).text,
      /items => items;/
    );
    assert.equal(
      reader.call('search_source', {
        version: 'head',
        query: 'consume(',
        prefix: '',
      }).length,
      1
    );
    assert.throws(() => reader.lines('head', '../caller.ts'), /relative/);
    assert.throws(
      () => reader.lines('head', 'scripts/agent-qa/known-findings.md'),
      /Outside/
    );
    assert.throws(() => reader.lines('HEAD', 'caller.ts'), /revision/);
    const review = {
      summary: 'Duplicated work',
      hypotheses: [
        {
          id: 'risk-1',
          changedFile: 'consumer.ts',
          invariant: 'Consume each item once',
          trigger: 'Call consume with one item',
          impact: 'Each item is processed twice',
          confidence: 'high',
          validation: 'Count items before and after consume',
          citations: [
            {
              version: 'base',
              file: 'consumer.ts',
              line: 1,
              quote: 'items => items;',
            },
            {
              version: 'head',
              file: 'consumer.ts',
              line: 1,
              quote: 'items.concat(items)',
            },
          ],
        },
      ],
    };
    assert.equal(
      verifySourceReview(review, { repo, base, head, files: ['consumer.ts'] })
        .input,
      'code-only; no PR prose or discussion'
    );
    const fake = structuredClone(review);
    fake.hypotheses[0].citations[1].quote = 'imaginary code';
    assert.throws(
      () =>
        verifySourceReview(fake, { repo, base, head, files: ['consumer.ts'] }),
      /citation mismatch/
    );
    const plan = {
      decision: 'test',
      reason: 'Changed consumption',
      changes: ['Consumption'],
      setup: { fixtures: [] },
      sourceReview: review,
      scenarios: [
        {
          id: 'change-1',
          change: 'Consumption',
          files: ['consumer.ts'],
          expected: 'One processing operation per item',
          steps: ['Count calls'],
          prerequisites: 'Instrumentation unavailable',
          method: 'unavailable',
          fixture: 'none',
          regression: 'none',
          riskIds: [],
          checkpoints: ['Count before and after'],
        },
      ],
    };
    assert.throws(
      () => verifyAssessment(plan, ['consumer.ts']),
      /Every independently discovered risk/
    );
    plan.scenarios[0].riskIds = ['risk-1'];
    assert.equal(verifyAssessment(plan, ['consumer.ts']), plan);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('evidence reviewer can inspect original frames but has no device or shell tools', () => {
  const args = reviewArgs(
    {
      cwd: '/tmp/qa',
      schema: '/tmp/schema',
      output: '/tmp/output',
      instructions: 'Review',
    },
    'evidence'
  );
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(!args.some((a) => a.includes('mcp_servers.argent')));
  assert.ok(args.some((a) => a.includes('inspect_action')));
  assert.ok(
    !args.some(
      (a) => a.includes('OPENROUTER_API_KEY') && a.includes('env_vars')
    )
  );
  const actions = [
    {
      index: 1,
      name: 'keyboard',
      arguments: { text: 'x' },
      content: [
        { type: 'text', text: 'A title moved' },
        { type: 'image', mimeType: 'image/png', data: 'frame-data' },
      ],
    },
  ];
  assert.equal(
    evidenceCall(actions, 'inspect_action', { index: 1 }).at(-1).data,
    'frame-data'
  );
  assert.throws(
    () => evidenceCall(actions, 'gesture-tap', { index: 1 }),
    /Unknown/
  );
  assert.throws(
    () => evidenceCall(actions, 'inspect_action', { index: 0 }),
    /Unknown/
  );
});

test('interleaved device responses remain attached to their original actions', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-actions-test-'));
  try {
    const trace = path.join(dir, 'trace.jsonl');
    writeFileSync(
      trace,
      [
        { type: 'request', id: 1, params: { name: 'describe', arguments: {} } },
        {
          type: 'request',
          id: 2,
          params: { name: 'screenshot', arguments: {} },
        },
        {
          type: 'response',
          id: 2,
          result: { content: [{ type: 'image', data: 'second' }] },
        },
        {
          type: 'response',
          id: 1,
          result: { content: [{ type: 'text', text: 'first' }] },
        },
      ]
        .map((x) => JSON.stringify(x))
        .join('\n')
    );
    const actions = readActions(trace);
    assert.equal(actions[0].content[0].text, 'first');
    assert.equal(actions[1].content[0].data, 'second');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unplanned defects cannot be hidden by passing planned checks or cite nonexistent actions', () => {
  const assessment = { scenarios: [{ files: ['screen.tsx'] }] };
  const discovery = {
    title: 'Visible control lost after input',
    file: 'screen.tsx',
    status: 'failed',
    invariant: 'Input preserves other controls',
    trigger: 'Enter text',
    observed: 'A control disappeared',
    evidenceActions: [1, 2],
  };
  const result = {
    status: 'passed',
    summary: 'Passed planned check',
    checks: [
      {
        status: 'passed',
        expected: 'Text saves',
        observed: 'Saved',
        evidence: ['codex-trace'],
      },
    ],
    discoveries: [discovery],
  };
  assert.equal(verifyDiscoveries(result, assessment, [{}, {}]), result);
  assert.throws(
    () =>
      verifyReport(result, new Map([['codex-trace', { screenshot: true }]])),
    /Incomplete or failed/
  );
  assert.throws(
    () => verifyDiscoveries(result, assessment, [{}]),
    /real before\/after/
  );
  assert.throws(
    () =>
      verifyDiscoveries(result, { scenarios: [{ files: ['other.tsx'] }] }, [
        {},
        {},
      ]),
    /relevant source/
  );
});
