import { afterEach, describe, expect, it } from 'vitest';

import {
  beginCronSilenceObservation,
  clearCronSilenceObservations,
  consumeCronSilenceOutput,
  recordCronSilenceOutput,
} from './cron-silence.js';

const ctx = {
  trigger: 'cron',
  runId: 'agent-run-1',
  sessionId: 'session-1',
  sessionKey: 'agent:main:cron:job-1',
};
const finished = {
  action: 'finished' as const,
  jobId: 'job-1',
  sessionTarget: 'isolated',
  sessionId: ctx.sessionId,
  sessionKey: ctx.sessionKey,
};
const silentMessage = {
  role: 'assistant',
  content: [{ type: 'text', text: 'NO_REPLY' }],
};
const end = { success: true, messages: [silentMessage] };

afterEach(clearCronSilenceObservations);

describe('cron silence evidence', () => {
  it.each([
    ['exact output', [silentMessage], true],
    ['no output', [], false],
    [
      'old assistant output followed by a tool',
      [silentMessage, { role: 'toolResult', content: [] }],
      false,
    ],
    [
      'old silent output followed by a report',
      [
        silentMessage,
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is the report' }],
        },
      ],
      false,
    ],
    [
      'tool call accompanying token',
      [
        {
          ...silentMessage,
          content: [
            ...silentMessage.content,
            { type: 'toolCall', name: 'search' },
          ],
        },
      ],
      false,
    ],
    [
      'thinking then token',
      [
        {
          ...silentMessage,
          content: [
            { type: 'thinking', thinking: 'private reasoning' },
            ...silentMessage.content,
          ],
        },
      ],
      true,
    ],
  ])(
    'uses only the final assistant output: %s',
    (_name, messages, expected) => {
      beginCronSilenceObservation(ctx);
      recordCronSilenceOutput(
        { success: true, messages: messages as unknown[] },
        ctx
      );
      expect(consumeCronSilenceOutput(finished)).toBe(expected);
    }
  );

  it('requires a matching observed run and session', () => {
    recordCronSilenceOutput(end, ctx);
    expect(consumeCronSilenceOutput(finished)).toBe(false);
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, { ...ctx, runId: 'another-run' });
    expect(consumeCronSilenceOutput(finished)).toBe(false);
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, { ...ctx, sessionId: 'another-session' });
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it.each([
    ['session ID', { sessionId: undefined }],
    ['trigger', { trigger: undefined }],
    ['both fields', { sessionId: undefined, trigger: undefined }],
  ])(
    'preserves same-run identity when the model hook omits %s',
    (_name, partial) => {
      beginCronSilenceObservation(ctx);
      beginCronSilenceObservation({ ...ctx, ...partial });
      recordCronSilenceOutput(end, ctx);
      expect(consumeCronSilenceOutput(finished)).toBe(true);
    }
  );

  it('resets prior output evidence on a partial same-run model start', () => {
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, ctx);
    beginCronSilenceObservation({
      ...ctx,
      sessionId: undefined,
      trigger: undefined,
    });
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it.each([
    [
      'different run',
      { runId: 'next-run', trigger: undefined, sessionId: undefined },
    ],
    ['missing run ID', { runId: undefined, trigger: undefined }],
    ['different session', { sessionId: 'next-session', trigger: undefined }],
    ['explicit non-cron turn', { trigger: 'user' }],
  ])('does not inherit cron identity for a %s', (_name, partial) => {
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, ctx);
    beginCronSilenceObservation({ ...ctx, ...partial });
    recordCronSilenceOutput(end, ctx);
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it('does not infer a cron run from an unrecognized partial hook', () => {
    beginCronSilenceObservation({ ...ctx, trigger: undefined });
    recordCronSilenceOutput(end, ctx);
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it.each(['cron', 'user'])(
    'clears stale evidence when a new %s turn starts',
    (trigger) => {
      beginCronSilenceObservation(ctx);
      recordCronSilenceOutput(end, ctx);
      beginCronSilenceObservation({ ...ctx, trigger, runId: 'next-run' });
      // A late completion from the previous run cannot mark the new run silent.
      recordCronSilenceOutput(end, ctx);
      expect(consumeCronSilenceOutput(finished)).toBe(false);
    }
  );

  it('overwrites a silent attempt when the agent later fails', () => {
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, ctx);
    recordCronSilenceOutput({ ...end, success: false, error: 'failed' }, ctx);
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it('drops evidence on gateway reset', () => {
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, ctx);
    clearCronSilenceObservations();
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });

  it('bounds retained observations', () => {
    beginCronSilenceObservation(ctx);
    recordCronSilenceOutput(end, ctx);
    for (let i = 0; i < 512; i++) {
      beginCronSilenceObservation({ ...ctx, sessionKey: `session-${i}` });
    }
    expect(consumeCronSilenceOutput(finished)).toBe(false);
  });
});
