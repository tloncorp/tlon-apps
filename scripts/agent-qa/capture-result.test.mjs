import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { appendInfrastructureFailure } from './core.mjs';

// Execute the real operator completion path with a failed trailing capture.
test('a crashed final capture retains completed findings for deferred review', async () => {
  const source = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8');
  const agent = source.slice(
    source.indexOf('async function agent(diff)'),
    source.indexOf('\nawait mkdir(artifacts,')
  );
  const result = {
    status: 'failed',
    summary: 'Text disappeared',
    checks: [
      {
        scenarioId: 'edit',
        status: 'failed',
        expected: 'Keep text',
        observed: 'Text disappeared',
        evidence: ['action-1'],
      },
    ],
    discoveries: [],
  };
  const sandbox = {
    evidence: new Map(),
    env: { QA_DEFER_REVIEW: 'true' },
    deviceEnv: {},
    artifacts: '/tmp/test',
    context: {
      assessment: { scenarios: [{ id: 'edit', method: 'simulator' }] },
    },
    udid: 'test',
    clean: (x) => x,
    usage: {},
    agentAbort: new AbortController(),
    runCodex: async () => result,
    writeFile: async () => {},
    path,
    capture: async () => {
      throw new Error('App lost accessibility');
    },
  };
  vm.createContext(sandbox);
  await assert.rejects(
    vm.runInContext(agent + '\nagent("")', sandbox),
    /lost accessibility/
  );
  const saved = appendInfrastructureFailure(
    sandbox.report,
    'Final capture failed'
  );
  assert.equal(saved.status, 'failed');
  assert.equal(saved.checks[0], result.checks[0]);
  assert.equal(sandbox.context.evidenceReview, 'pending');
});
