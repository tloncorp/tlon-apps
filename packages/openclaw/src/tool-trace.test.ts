import { describe, expect, it } from 'vitest';

import {
  _testing,
  formatToolTraceEvent,
  liveToolTraceContentsEnabled,
  shouldLogAfterToolTrace,
} from './tool-trace.js';

describe('tool trace helpers', () => {
  it('detects env-gated content tracing', () => {
    expect(
      liveToolTraceContentsEnabled({
        TEST_LIVE_TOOL_TRACE_CONTENTS: '1',
      } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(
      liveToolTraceContentsEnabled({
        CI_LIVE_TOOL_TRACE_CONTENTS: 'true',
      } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(
      liveToolTraceContentsEnabled({
        TEST_LIVE_TOOL_TRACE_CONTENTS: '0',
      } as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  it('redacts sensitive keys and truncates long strings', () => {
    const event = formatToolTraceEvent({
      phase: 'after',
      sessionKey: 'session-123',
      toolName: 'read',
      payload: {
        token: 'secret-token',
        bearerToken: 'bearer-secret',
        accessKeyId: 'AKIA_TEST',
        secretAccessKey: 'aws-secret',
        clientSecret: 'client-secret',
        bucketName: 'visible-bucket',
        messageTokenCount: 42,
        nested: {
          password: 'hunter2',
          text: 'x'.repeat(350),
        },
      },
    });

    expect(event).toContain('"toolName":"read"');
    expect(event).toContain('"token":"[REDACTED]"');
    expect(event).toContain('"bearerToken":"[REDACTED]"');
    expect(event).toContain('"accessKeyId":"[REDACTED]"');
    expect(event).toContain('"secretAccessKey":"[REDACTED]"');
    expect(event).toContain('"clientSecret":"[REDACTED]"');
    expect(event).toContain('"bucketName":"visible-bucket"');
    expect(event).toContain('"messageTokenCount":42');
    expect(event).toContain('"password":"[REDACTED]"');
    expect(event).toContain('[350 chars]');
    expect(event).not.toContain('secret-token');
    expect(event).not.toContain('bearer-secret');
    expect(event).not.toContain('AKIA_TEST');
    expect(event).not.toContain('aws-secret');
    expect(event).not.toContain('client-secret');
    expect(event).not.toContain('hunter2');
  });

  it.each(['before', 'after'] as const)(
    'redacts browser handoff commands in %s events before truncation',
    (phase) => {
      for (const command of [
        'browser handoff https://browser.example/s/private.signature',
        '--ship=~zod browser handoff "https://browser.example/s/private.signature"',
        `browser handoff https://browser.example/s/private.signature${'x'.repeat(3000)}`,
      ]) {
        const payload = { params: { command } };
        const event = formatToolTraceEvent({
          phase,
          toolName: 'tlon',
          payload,
        });
        expect(event).toContain('"command":"browser handoff [REDACTED]"');
        expect(event).not.toContain('browser.example');
        expect(event).not.toContain('private.signature');
        expect(payload.params.command).toBe(command);
      }
    }
  );

  it('preserves ordinary command arguments', () => {
    expect(_testing.sanitizeValue({ command: 'contacts get ~zod' })).toEqual({
      command: 'contacts get ~zod',
    });
  });

  it('collapses deep and oversized structures', () => {
    const sanitized = _testing.sanitizeValue({
      items: Array.from({ length: 25 }, (_, i) => i),
      deep: { a: { b: { c: { d: { e: true } } } } },
    });

    expect(sanitized).toEqual({
      items: [...Array.from({ length: 20 }, (_, i) => i), '[+5 more items]'],
      deep: { a: { b: { c: '[Object keys=1]' } } },
    });
  });

  it('suppresses incomplete duplicate after events', () => {
    expect(
      shouldLogAfterToolTrace({
        result: { ok: true },
        durationMs: undefined,
        error: undefined,
      })
    ).toBe(false);

    expect(
      shouldLogAfterToolTrace({
        result: { ok: true },
        durationMs: 123,
        error: undefined,
      })
    ).toBe(true);

    expect(
      shouldLogAfterToolTrace({
        result: undefined,
        durationMs: undefined,
        error: 'boom',
      })
    ).toBe(true);
  });
});
