import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserSessionTelemetryId,
  observeBrowserToolStart,
  observeBrowserToolResult,
  reportBrowserLifecycle,
  setBrowserTelemetryReporter,
} from './browser-telemetry.js';

const handle = 'sess_MHKz9dQ1TjqLmA7vXpR2bw';
const context = {
  sessionKey: 'agent:main:main',
  runId: 'run-1',
  toolCallId: 'call-1',
};
const call = (operation: string) => ({
  toolName: 'mcp__call',
  params: {
    name: `browser_browser_${operation}`,
    arguments: { session_id: handle, password: 'secret' },
  },
});
afterEach(() => setBrowserTelemetryReporter(null));

describe('browser lifecycle observation', () => {
  it('correlates operation starts and completed sessions without exposing handles or payloads', () => {
    const capture = vi.fn();
    setBrowserTelemetryReporter(capture);
    observeBrowserToolStart(call('session_create'), context);
    observeBrowserToolResult(
      {
        ...call('session_create'),
        result: {
          details: {
            structuredContent: { session_id: handle, viewer_url: 'secret-url' },
          },
        },
        durationMs: 123,
      },
      context
    );
    observeBrowserToolResult(
      { ...call('session_release'), result: { isError: false } },
      { ...context, runId: 'run-2' }
    );
    expect(capture.mock.calls.map(([e]) => e.phase)).toEqual([
      'operation_started',
      'session_created',
      'session_released',
    ]);
    expect(capture.mock.calls[1][0]).toMatchObject({
      browserSessionId: browserSessionTelemetryId(handle),
      outcome: 'accepted',
      taskOutcome: 'unknown',
      durationMs: 123,
      ...context,
    });
    expect(capture.mock.calls[2][0]).toMatchObject({
      browserSessionId: browserSessionTelemetryId(handle),
      outcome: 'accepted',
      taskOutcome: 'unknown',
      runId: 'run-2',
    });
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/secret|sess_MHK/);
  });

  it.each([
    [
      { isError: true, content: [{ type: 'text', text: 'secret failure' }] },
      'failed',
    ],
    [{ details: { isError: true } }, 'failed'],
    [
      { details: { mcpServer: 'mcp', mcpTool: 'call', status: 'error' } },
      'failed',
    ],
    [
      { content: [{ type: 'text', text: JSON.stringify({ isError: true }) }] },
      'failed',
    ],
    [{ content: [{ type: 'text', text: 'OK' }] }, 'unknown'],
  ])(
    'does not confuse a completed tool call with success: %j',
    (result, outcome) => {
      const capture = vi.fn();
      setBrowserTelemetryReporter(capture);
      observeBrowserToolResult({ ...call('navigate'), result }, context);
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ outcome, taskOutcome: 'unknown' })
      );
    }
  );

  it('keeps transport failures and missing create ids out of successful-session counts', () => {
    const capture = vi.fn();
    setBrowserTelemetryReporter(capture);
    observeBrowserToolResult(
      { ...call('session_create'), error: 'private URL' },
      context
    );
    observeBrowserToolResult(
      { ...call('session_create'), result: { isError: false } },
      context
    );
    expect(capture.mock.calls.map(([e]) => e.outcome)).toEqual([
      'failed',
      'unknown',
    ]);
    expect(
      capture.mock.calls.every(([e]) => e.browserSessionId === undefined)
    ).toBe(true);
    expect(browserSessionTelemetryId('https://secret')).toBeUndefined();
  });

  it('ignores other services and prevents observer failures from affecting tools', () => {
    const capture = vi.fn();
    setBrowserTelemetryReporter(capture);
    observeBrowserToolResult(
      { toolName: 'mcp__call', params: { name: 'mail_read' } },
      context
    );
    expect(capture).not.toHaveBeenCalled();
    setBrowserTelemetryReporter(() => {
      throw new Error('sink down');
    });
    expect(() =>
      reportBrowserLifecycle({
        source: 'agent',
        phase: 'handoff_requested',
        outcome: 'unknown',
      })
    ).not.toThrow();
  });
});
