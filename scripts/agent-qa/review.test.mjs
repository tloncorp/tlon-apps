import { verifyReport } from './core.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {
  sourceReader,
  evidenceCall,
  readActions,
  hasActionEvidence,
} from './review-tools.mjs';
import {
  reviewArgs,
  verifyDiscoveries,
  unresolvedVideoAssessment,
  replayVideoOnly,
  reviewEvidence,
} from './review.mjs';
import { verifyAssessment } from './assess.mjs';

test('pending passed or failed replay cannot bypass full evidence review', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-pending-replay-'));
  try {
    for (const status of ['passed', 'failed']) {
      const mode = replayVideoOnly({ evidenceReview: 'pending' }, false);
      assert.equal(mode, false);
      await assert.rejects(
        reviewEvidence({
          assessment: {
            scenarios: [
              { id: 'change-1', method: 'simulator', files: ['app.ts'] },
            ],
          },
          result: { status, checks: [{ scenarioId: 'change-1', status }] },
          artifacts: dir,
          videoOnly: mode,
        }),
        /ENOENT/
      );
    }
    assert.equal(replayVideoOnly({ evidenceReview: 'completed' }, false), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
  assert.ok(!args.some((a) => a.includes('mcp_servers.device')));
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
        .map(nativeEvent)
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
  const completed = {
    responseReceived: true,
    isError: false,
    content: [{ type: 'text', text: 'Observed state' }],
  };
  assert.equal(
    verifyDiscoveries(result, assessment, [completed, completed]),
    result
  );
  for (const invalid of [
    { responseReceived: false, content: [] },
    { responseReceived: true, content: [] },
    { ...completed, isError: true },
    { responseReceived: true, content: [{ type: 'text', text: '  ' }] },
  ]) {
    assert.throws(
      () => verifyDiscoveries(result, assessment, [completed, invalid]),
      /real before\/after/
    );
    assert.throws(
      () => verifyDiscoveries(result, assessment, [invalid, invalid]),
      /real before\/after/
    );
  }
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

test('video follow-up prioritizes unresolved checks and preserves the full source scope', () => {
  const assessment = {
    scenarios: [
      { id: 'change-1', method: 'simulator', files: ['one.tsx'] },
      { id: 'change-2', method: 'simulator', files: ['two.tsx'] },
      { id: 'change-3', method: 'unavailable', files: ['three.tsx'] },
      { id: 'change-4', method: 'regression', files: ['four.ts'] },
      { id: 'change-5', method: 'simulator', files: ['five.tsx'] },
    ],
  };
  const plan = unresolvedVideoAssessment(assessment, {
    checks: [
      { scenarioId: 'change-1', status: 'passed' },
      { scenarioId: 'change-2', status: 'blocked' },
      { scenarioId: 'change-5', status: 'failed' },
    ],
  });
  assert.deepEqual(
    plan.scenarios.map((s) => s.id),
    ['change-2', 'change-3']
  );
  assert.equal(plan.files.length, 5);
});

test('pending requests remain indexed attempts and cannot establish observations', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-pending-'));
  try {
    const file = path.join(dir, 'trace.jsonl');
    writeFileSync(
      file,
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
          result: { content: [{ type: 'image', data: 'frame' }] },
        },
        { type: 'request', id: 3, params: { name: 'describe', arguments: {} } },
        {
          type: 'response',
          id: 3,
          result: { isError: true, content: [{ type: 'text', text: 'Error' }] },
        },
      ]
        .map(nativeEvent)
        .map(JSON.stringify)
        .join('\n')
    );
    const actions = readActions(file);
    assert.deepEqual(
      actions.map((a) => a.index),
      [1, 2, 3]
    );
    assert.deepEqual(actions.map(hasActionEvidence), [false, true, false]);
    const shown = JSON.parse(
      evidenceCall(actions, 'inspect_action', { index: 1 })[0].text
    );
    assert.equal(shown.responseReceived, false);
    assert.equal(
      JSON.parse(evidenceCall(actions, 'list_actions', {})[0].text)[1].index,
      2
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function nativeEvent(entry) {
  return {
    type: entry.type === 'request' ? 'item.started' : 'item.completed',
    at: new Date().toISOString(),
    item: {
      id: String(entry.id),
      type: 'mcp_tool_call',
      server: 'device',
      tool: entry.params?.name || 'snapshot',
      arguments: entry.params?.arguments || {},
      result: entry.result,
      error: entry.error,
    },
  };
}
