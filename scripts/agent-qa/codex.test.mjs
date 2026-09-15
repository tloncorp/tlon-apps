import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  supervise,
  verifyCodexAuth,
  allowArgentCall,
  resultSchemaFor,
  interruptedResult,
} from './codex.mjs';

test('operator and video reviewer schemas satisfy provider strict-object requirements', () => {
  function verify(schema) {
    if (schema.type === 'object') {
      assert.deepEqual(
        new Set(schema.required),
        new Set(Object.keys(schema.properties))
      );
      for (const child of Object.values(schema.properties)) verify(child);
    }
    if (schema.items) verify(schema.items);
  }
  const operator = resultSchemaFor();
  const reviewer = resultSchemaFor(undefined, { video: true });
  verify(operator);
  verify(reviewer);
  assert.equal(
    operator.properties.discoveries.items.properties.clipEvidence,
    undefined
  );
  assert.ok(
    reviewer.properties.discoveries.items.required.includes('clipEvidence')
  );
});

test('operator interruption keeps each acceptance criterion pending for review', () => {
  const plan = {
    scenarios: [
      { id: 'edit', method: 'simulator', expected: 'The edited text persists' },
      { id: 'missing', method: 'unavailable', expected: 'Peer receives text' },
      { id: 'unit', method: 'regression', expected: 'Parser retains text' },
    ],
  };
  const result = interruptedResult(plan, 'time limit');
  assert.deepEqual(
    result.checks.map((c) => [c.scenarioId, c.expected, c.status]),
    [
      ['edit', 'The edited text persists', 'blocked'],
      ['missing', 'Peer receives text', 'blocked'],
    ]
  );
  assert.deepEqual(result.discoveries, []);
  assert.ok(result.checks.every((c) => c.evidence.length === 0));
});

test('device boundary rejects other simulators, apps, tools and exhausted runs', () => {
  const valid = { name: 'describe', arguments: { udid: 'assigned-device' } };
  assert.doesNotThrow(() =>
    allowArgentCall(valid, 'assigned-device', 'io.tlon.groups', 1)
  );
  assert.throws(
    () => allowArgentCall(valid, 'other-device', 'io.tlon.groups', 1),
    /assigned simulator/
  );
  assert.throws(
    () =>
      allowArgentCall(
        { ...valid, name: 'debugger-evaluate' },
        'assigned-device',
        'io.tlon.groups',
        1
      ),
    /outside/
  );
  assert.throws(
    () =>
      allowArgentCall(
        {
          name: 'launch-app',
          arguments: {
            udid: 'assigned-device',
            bundleId: 'com.apple.mobilesafari',
          },
        },
        'assigned-device',
        'io.tlon.groups',
        1
      ),
    /app under test/
  );
  assert.throws(
    () => allowArgentCall(valid, 'assigned-device', 'io.tlon.groups', 101),
    /100-tool-call/
  );
});

test('missing or denied OpenRouter credentials fail before device setup', async () => {
  let called = false;
  await assert.rejects(
    verifyCodexAuth('', async () => {
      called = true;
    }),
    /OPENROUTER_API_KEY/
  );
  assert.equal(called, false);
  await assert.rejects(
    verifyCodexAuth('test', async () => ({ ok: false, status: 403 })),
    /HTTP 403/
  );
});

function run(script, options = {}) {
  return supervise(process.execPath, ['-e', script], {
    env: { PATH: process.env.PATH },
    cwd: '/tmp',
    prompt: 'test',
    onEvent: async () => {},
    timeoutMs: 2000,
    ...options,
  });
}

test('saves real event output and diagnostics before resolving', async () => {
  const events = [];
  await run(
    `console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10}})); console.error('diagnostic')`,
    {
      onEvent: async (event) => {
        events.push(event);
      },
    }
  );
  assert.equal(events[0].usage.input_tokens, 10);
  assert.match(events[1].text, /diagnostic/);
});

test('kills a stuck child and still collects diagnostics', async () => {
  const events = [];
  await assert.rejects(
    run('setInterval(() => {}, 100)', {
      timeoutMs: 100,
      onEvent: async (event) => {
        events.push(event);
      },
    }),
    /test limit/
  );
  assert.equal(events.at(-1).type, 'harness.stderr');
});

test('rejects malformed output and nonzero exit rather than trusting a final file', async () => {
  await assert.rejects(
    run(`console.log('not json'); setInterval(() => {}, 100)`),
    /invalid JSONL/
  );
  await assert.rejects(run('process.exit(2)'), /status 2/);
});

test('stops runaway tool use', async () => {
  await assert.rejects(
    run(
      `for(let i=0;i<101;i++) console.log(JSON.stringify({type:'item.started',item:{type:'mcp_tool_call'}})); setInterval(() => {}, 100)`
    ),
    /100-tool-call/
  );
});

test('parent cancellation terminates the agent', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await assert.rejects(
      run('setInterval(() => {}, 100)', { signal: controller.signal }),
      /interrupted/
    );
  } finally {
    clearTimeout(timer);
  }
});

test('PR output schema rejects the generic smoke finding that broke the live run', () => {
  const schema = resultSchemaFor({
    scenarios: [
      {
        id: 'change-1',
        expected: 'Native header remains clear while scrolling',
      },
      { id: 'change-2', expected: 'Edit opens the editor' },
    ],
  });
  const props = schema.properties.checks.items.properties;
  assert.deepEqual(props.scenarioId.enum, ['change-1', 'change-2']);
  assert.ok(!props.scenarioId.enum.includes('harness'));
  assert.deepEqual(props.expected.enum, [
    'Native header remains clear while scrolling',
    'Edit opens the editor',
  ]);
  assert.deepEqual(
    resultSchemaFor().properties.checks.items.properties.scenarioId.enum,
    ['harness']
  );
});
