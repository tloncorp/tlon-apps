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
  cronTestRunResult,
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
      normalizeThinkingLevel: (raw?: string | null) =>
        raw === 'on' ? 'low' : (raw ?? undefined),
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
      cleanupBundleMcpOnRunEnd: true,
    });
    expect(params).not.toHaveProperty('thinkLevel');
    // The gateway's configured agent timeout, as a scheduled run gets; the
    // runner passes what is left of it.
    expect(params.timeoutMs).toBeGreaterThan(59_000);
    expect(params.timeoutMs).toBeLessThanOrEqual(60_000);
    expect(params).not.toHaveProperty('runTimeoutOverrideMs');
    expect(params).not.toHaveProperty('bootstrapContextMode');
    // A short run keeps the default lens lifetime.
    const created = published[0]!.lens;
    expect(created.expiresAt - created.createdAt).toBe(30 * 60_000);
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

  it('loads the context and thinking level a job asks for', async () => {
    const { deps, run, runEmbeddedAgent, started, finalLens } = harness(
      'job-light',
      [
        {
          ...digest,
          id: 'job-light',
          payload: { ...digest.payload, lightContext: true, thinking: 'on' },
        },
      ]
    );

    await startCronTestRun('job-light', deps);
    await started();

    expect(runEmbeddedAgent.mock.calls[0]![0]).toMatchObject({
      bootstrapContextMode: 'lightweight',
      bootstrapContextRunKind: 'cron',
      thinkLevel: 'low',
    });
    run.resolve({ payloads: [{ text: 'Done.' }], meta: { durationMs: 1 } });
    await finalLens();
  });

  it("keeps to the job's own timeout when it sets one", async () => {
    const { deps, run, runEmbeddedAgent, published, started, finalLens } =
      harness('job-timeout', [
        {
          ...digest,
          id: 'job-timeout',
          payload: { ...digest.payload, timeoutSeconds: 3_600 },
        },
      ]);

    await startCronTestRun('job-timeout', deps);
    await started();

    const params = runEmbeddedAgent.mock.calls[0]![0];
    expect(params.runTimeoutOverrideMs).toBe(3_600_000);
    expect(params.timeoutMs).toBeGreaterThan(3_599_000);
    // The lens outlives the hour the run may take.
    const created = published[0]!.lens;
    expect(created.expiresAt - created.createdAt).toBe(3_600_000 + 10 * 60_000);
    run.resolve({ payloads: [{ text: 'Done.' }], meta: { durationMs: 1 } });
    await finalLens();
  });

  it("fails over to the job's fallback model before any tool runs", async () => {
    const { deps, runEmbeddedAgent, finalLens } = harness('job-fallback', [
      {
        ...digest,
        id: 'job-fallback',
        payload: {
          ...digest.payload,
          model: 'anthropic/primary',
          fallbacks: ['openai/backup'],
        },
      },
    ]);
    runEmbeddedAgent
      .mockReset()
      .mockRejectedValueOnce(
        Object.assign(new Error('overloaded'), {
          name: 'FailoverError',
          reason: 'overloaded',
        })
      )
      .mockResolvedValueOnce({
        payloads: [{ text: 'From the backup.' }],
        meta: { durationMs: 1 },
      });

    await startCronTestRun('job-fallback', deps);

    expect(await finalLens()).toMatchObject({
      status: 'completed',
      cron: { output: 'From the backup.' },
    });
    expect(runEmbeddedAgent.mock.calls.map(([params]) => params.model)).toEqual(
      ['anthropic/primary', 'openai/backup']
    );
  });

  it('stops as aborted when its monitor goes away', async () => {
    const abort = new AbortController();
    const { deps, runEmbeddedAgent, started, finalLens } = harness('job-abort');
    runEmbeddedAgent
      .mockReset()
      .mockImplementation(
        ({ abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise((_, reject) =>
            abortSignal.addEventListener('abort', () =>
              reject(new Error('aborted'))
            )
          )
      );

    await startCronTestRun('job-abort', { ...deps, signal: abort.signal });
    await started();
    abort.abort();

    expect(await finalLens()).toMatchObject({ status: 'aborted' });
  });

  it('times out, rather than stops, when its own limit ends it', async () => {
    const limit = harness('job-limit');
    await startCronTestRun('job-limit', limit.deps);
    limit.run.resolve({ meta: { durationMs: 60_000, aborted: true } });
    expect(await limit.finalLens()).toMatchObject({
      status: 'timed_out',
      error: 'The test run ran out of time.',
    });

    // An aborted result after the monitor went away is the monitor's stop.
    const abort = new AbortController();
    const stopped = harness('job-stopped');
    await startCronTestRun('job-stopped', {
      ...stopped.deps,
      signal: abort.signal,
    });
    await stopped.started();
    abort.abort();
    stopped.run.resolve({ meta: { durationMs: 1, aborted: true } });
    expect(await stopped.finalLens()).toMatchObject({ status: 'aborted' });
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

  it('starts a new run once the job has changed', async () => {
    const job = { ...digest, id: 'job-changed', updatedAtMs: 1 };
    const { deps, run, runEmbeddedAgent, published } = harness('job-changed', [
      job,
    ]);

    const first = await startCronTestRun('job-changed', deps);
    // Saved again while the first test runs.
    job.updatedAtMs = 2;
    const second = await startCronTestRun('job-changed', deps);
    const third = await startCronTestRun('job-changed', deps);

    expect(second.type === 'started' && second.lensId).not.toBe(
      first.type === 'started' && first.lensId
    );
    expect(third).toEqual(second);
    await vi.waitFor(() => expect(runEmbeddedAgent).toHaveBeenCalledTimes(2));
    run.resolve({ payloads: [{ text: 'Done.' }], meta: { durationMs: 1 } });
    await vi.waitFor(() =>
      expect(published.filter(({ phase }) => phase === 'final')).toHaveLength(2)
    );
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

  it('fails a run whose only answer is an error, not one with a reply', () => {
    expect(
      cronTestRunResult({
        payloads: [{ text: 'Provider billing error', isError: true }],
        meta: { durationMs: 1 },
      })
    ).toEqual({ status: 'error', error: 'Provider billing error' });
    // The host's warning about a failed tool, as a blocked write gives,
    // follows the reply; the reply stands.
    expect(
      cronTestRunResult({
        payloads: [
          { text: 'Three new threads today.' },
          { text: '⚠️ 🛠️ tlon failed', isError: true },
        ],
        meta: { durationMs: 1 },
      })
    ).toEqual({ status: 'completed', output: 'Three new threads today.' });
  });

  it('refuses a job the credit budget paused', async () => {
    const { deps, runEmbeddedAgent } = harness('job-held', [
      {
        ...digest,
        id: 'job-held',
        enabled: false,
        description: '[Paused: credit budget] Daily digest',
      },
    ]);

    expect(await startCronTestRun('job-held', deps)).toEqual({
      type: 'error',
      errorType: 'invalid',
      message: ['this task is paused while credits are limited'],
    });
    expect(runEmbeddedAgent).not.toHaveBeenCalled();
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
  it('fails closed: tools not known to only read are blocked', () => {
    for (const tool of ['exec', 'write', 'browser', 'mcp__call', 'nodes']) {
      expect(cronTestRunToolBlock(tool, {})).toBe(CRON_TEST_RUN_BLOCK_REASON);
    }
    for (const tool of [
      'read',
      'web_fetch',
      'memory_search',
      'mcp__describe',
    ]) {
      expect(cronTestRunToolBlock(tool, {})).toBeNull();
    }
    // Only Tlon reads, not its catch-all utility commands.
    expect(cronTestRunToolBlock('tlon', { command: 'help' })).toBe(
      CRON_TEST_RUN_BLOCK_REASON
    );
  });

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
