import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import type { ContextLens } from './context-lens.js';
import {
  CRON_TEST_RUN_BLOCK_REASON,
  type CronTestRunDeps,
  buildCronTestPrompt,
  cronTestRunToolBlock,
  defaultCronAgentId,
  isCronTestSessionKey,
  startCronTestRun,
} from './cron-test-run.js';

const config = {
  agents: { defaults: { userTimezone: 'UTC' } },
} as unknown as OpenClawConfig;

const digest = {
  id: 'job-digest',
  name: 'Daily digest',
  agentId: 'main',
  payload: {
    kind: 'agentTurn',
    message: 'Summarize the group.',
    toolsAllow: ['tlon', 'web_search'],
  },
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Each test runs its own job: a run left going by one test would otherwise
// answer the next test's start.
function harness(id: string, jobs: unknown[] = [{ ...digest, id }]) {
  const run = deferred<unknown>();
  const published: { phase: string; lens: ContextLens }[] = [];
  const runEmbeddedAgent = vi.fn().mockReturnValue(run.promise);
  const deps: CronTestRunDeps = {
    listJobs: async () => jobs,
    defaultAgentId: () => 'main',
    config,
    runtime: {
      runEmbeddedAgent,
      resolveAgentWorkspaceDir: () => '/workspace',
      resolveAgentDir: () => '/agent',
      resolveAgentTimeoutMs: vi.fn(({ overrideSeconds }) =>
        overrideSeconds ? overrideSeconds * 1_000 : 60_000
      ),
    } as unknown as CronTestRunDeps['runtime'],
    stateDir: () => mkdtempSync(path.join(tmpdir(), 'cron-test-run-')),
    publish: (phase, lens) => published.push({ phase, lens }),
    logger: { warn: vi.fn() },
    now: () => Date.UTC(2026, 9, 12, 9, 0),
  };
  const started = () =>
    vi.waitFor(() => expect(runEmbeddedAgent).toHaveBeenCalled());
  const finalLens = async () => {
    await vi.waitFor(() =>
      expect(published.some(({ phase }) => phase === 'final')).toBe(true)
    );
    return published.find(({ phase }) => phase === 'final')!.lens;
  };
  return { deps, run, runEmbeddedAgent, published, started, finalLens };
}

describe('startCronTestRun', () => {
  it('runs the job once, delivering nowhere, and keeps its reply', async () => {
    const { deps, run, runEmbeddedAgent, published, started, finalLens } =
      harness('job-digest');

    const answer = await startCronTestRun('job-digest', deps);
    await started();

    expect(answer).toEqual({
      type: 'started',
      id: 'job-digest',
      lensId: expect.any(String),
    });
    const lensId = answer.type === 'started' ? answer.lensId : '';
    expect(published[0]).toMatchObject({
      phase: 'created',
      lens: {
        lensId,
        runKind: 'cron',
        cron: { jobId: 'job-digest', test: true },
      },
    });
    const params = runEmbeddedAgent.mock.calls[0]![0];
    expect(params).toMatchObject({
      agentId: 'main',
      trigger: 'cron',
      jobId: 'job-digest',
      disableMessageTool: true,
      toolsAllow: ['tlon', 'web_search'],
      bootstrapContextRunKind: 'cron',
      // The gateway's configured agent timeout, as a scheduled run gets.
      timeoutMs: 60_000,
    });
    expect(params).not.toHaveProperty('runTimeoutOverrideMs');
    // The lens lasts as long as the run may, and then some.
    const created = published[0]!.lens;
    expect(created.expiresAt - created.createdAt).toBe(60_000 + 10 * 60_000);
    expect(isCronTestSessionKey(params.sessionKey)).toBe(true);
    expect(params.prompt).toContain(
      '[cron:job-digest Daily digest] Summarize the group.'
    );

    run.resolve({
      payloads: [
        { text: 'Thinking it over', isReasoning: true },
        { text: 'Three new threads today.' },
      ],
      meta: { durationMs: 1200 },
    });

    expect(await finalLens()).toMatchObject({
      lensId,
      status: 'completed',
      cron: {
        jobId: 'job-digest',
        test: true,
        output: 'Three new threads today.',
      },
    });
  });

  it("keeps to the job's own timeout when it sets one", async () => {
    const { deps, run, runEmbeddedAgent, started, finalLens } = harness(
      'job-timeout',
      [
        {
          ...digest,
          id: 'job-timeout',
          payload: { ...digest.payload, timeoutSeconds: 90 },
        },
      ]
    );

    await startCronTestRun('job-timeout', deps);
    await started();

    expect(runEmbeddedAgent.mock.calls[0]![0]).toMatchObject({
      timeoutMs: 90_000,
      runTimeoutOverrideMs: 90_000,
    });
    run.resolve({ payloads: [{ text: 'Done.' }], meta: { durationMs: 1 } });
    await finalLens();
  });

  it('answers a second ask with the run already going', async () => {
    const { deps, run, runEmbeddedAgent, started, finalLens } =
      harness('job-twice');

    const first = await startCronTestRun('job-twice', deps);
    const second = await startCronTestRun('job-twice', deps);
    await started();

    expect(second).toEqual(first);
    expect(runEmbeddedAgent).toHaveBeenCalledOnce();
    run.resolve({ payloads: [{ text: 'Done.' }], meta: { durationMs: 1 } });
    await finalLens();
  });

  it('records a silent reply as no reply and a failed run as an error', async () => {
    const silent = harness('job-silent');
    await startCronTestRun('job-silent', silent.deps);
    silent.run.resolve({
      payloads: [{ text: 'NO_REPLY' }],
      meta: { durationMs: 1 },
    });
    expect(await silent.finalLens()).toMatchObject({ status: 'no_reply' });

    const failed = harness('job-failed');
    await startCronTestRun('job-failed', failed.deps);
    failed.run.resolve({
      meta: {
        durationMs: 1,
        error: { kind: 'retry_limit', message: 'provider overloaded' },
      },
    });
    expect(await failed.finalLens()).toMatchObject({
      status: 'error',
      error: 'provider overloaded',
    });
  });

  it('refuses an unknown job and one with nothing to run', async () => {
    const { deps, runEmbeddedAgent } = harness('job-none', [
      { id: 'job-empty', payload: { kind: 'agentTurn', message: '  ' } },
    ]);

    expect(await startCronTestRun('job-missing', deps)).toMatchObject({
      type: 'error',
      errorType: 'not-found',
    });
    expect(await startCronTestRun('job-empty', deps)).toMatchObject({
      type: 'error',
      errorType: 'invalid',
    });
    expect(runEmbeddedAgent).not.toHaveBeenCalled();
  });
});

describe('startCronTestRun on a job a test cannot stand in for', () => {
  it('refuses main-session jobs and system events', async () => {
    const { deps, runEmbeddedAgent } = harness('job-main', [
      { ...digest, id: 'job-main', sessionTarget: 'main' },
      {
        id: 'job-event',
        sessionTarget: 'isolated',
        payload: { kind: 'systemEvent', text: 'Check the inbox.' },
      },
    ]);

    for (const jobId of ['job-main', 'job-event']) {
      const answer = await startCronTestRun(jobId, deps);
      expect(answer).toMatchObject({ type: 'error', errorType: 'invalid' });
      expect(answer.type === 'error' && answer.message[0]).toContain(
        'main session'
      );
    }
    expect(runEmbeddedAgent).not.toHaveBeenCalled();
  });
});

describe('cronTestRunToolBlock', () => {
  it('blocks sending, scheduling, and Tlon writes, and allows reads', () => {
    expect(cronTestRunToolBlock('message', {})).toBe(
      CRON_TEST_RUN_BLOCK_REASON
    );
    expect(cronTestRunToolBlock('cron', { action: 'add' })).toBe(
      CRON_TEST_RUN_BLOCK_REASON
    );
    expect(
      cronTestRunToolBlock('tlon', { command: 'contacts del ~sampel-palnet' })
    ).toBe(CRON_TEST_RUN_BLOCK_REASON);
    expect(
      cronTestRunToolBlock('tlon', {
        command: 'buckets read buckets/~zod/private-files 12',
      })
    ).toBeNull();
    expect(cronTestRunToolBlock('web_search', { query: 'news' })).toBeNull();
  });

  it('keeps the block reason inside the one-line cap', () => {
    expect(CRON_TEST_RUN_BLOCK_REASON.length).toBeLessThanOrEqual(200);
  });
});

describe('buildCronTestPrompt', () => {
  it('frames the prompt the way the host frames a cron turn', () => {
    const prompt = buildCronTestPrompt(
      digest,
      'Summarize the group.',
      config,
      Date.UTC(2026, 9, 12, 9, 0)
    );
    expect(prompt.split('\n')[0]).toBe(
      '[cron:job-digest Daily digest] Summarize the group.'
    );
    expect(prompt).toContain('(UTC)\nReference UTC: 2026-10-12 09:00 UTC');
    expect(prompt).toContain('it will be delivered automatically');
  });
});

describe('defaultCronAgentId', () => {
  it("prefers the cron service's default, then the config's", () => {
    expect(defaultCronAgentId({ getDefaultAgentId: () => 'ops' }, config)).toBe(
      'ops'
    );
    expect(
      defaultCronAgentId(undefined, {
        agents: { list: [{ id: 'a' }, { id: 'b', default: true }] },
      } as unknown as OpenClawConfig)
    ).toBe('b');
    expect(defaultCronAgentId(undefined, config)).toBe('main');
  });
});
