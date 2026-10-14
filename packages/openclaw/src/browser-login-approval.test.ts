import { describe, expect, it, vi } from 'vitest';
import { createBrowserLoginApprovalHandler } from './browser-login-approval.js';

function event() {
  return {
    toolName: 'mcp__call',
    params: {
      name: 'browser_browser_login',
      arguments: { session_id: 'fresh-ivory-finch', action: 'use' },
    },
    result: {
      details: {
        structuredContent: {
          session_id: 'fresh-ivory-finch',
          login: { status: 'approval_required' },
        },
      },
    },
  };
}

describe('saved login approval delivery', () => {
  it('sends a secure card for the requested session without passing credentials or record metadata', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await createBrowserLoginApprovalHandler(send).handle(event());
    expect(send).toHaveBeenCalledExactlyOnceWith(
      'fresh-ivory-finch',
      undefined
    );
  });

  it('passes only the requested account identity into the approval card', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const request = event();
    const choice = { id: '8e40b5f5-fd41-4851-8922-b9545e470d6e', revision: 3 };
    await createBrowserLoginApprovalHandler(send).handle({
      ...request,
      params: {
        ...request.params,
        arguments: { ...request.params.arguments, record: choice },
      },
    });
    expect(send).toHaveBeenCalledExactlyOnceWith('fresh-ivory-finch', choice);
  });

  it.each([
    { toolName: 'untrusted_tool' },
    { params: { ...event().params, name: 'other_browser_login' } },
    {
      params: {
        ...event().params,
        arguments: { session_id: 'fresh-ivory-finch', action: 'list' },
      },
    },
    {
      params: {
        ...event().params,
        arguments: { session_id: 'different-session' },
      },
    },
    { error: 'failed' },
    { result: { ...event().result, isError: true } },
    { result: { details: { ...event().result.details, status: 'error' } } },
    {
      result: {
        details: {
          structuredContent: {
            session_id: 'fresh-ivory-finch',
            login: { status: 'filled' },
          },
        },
      },
    },
    {
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(event().result.details.structuredContent),
          },
        ],
      },
    },
  ])(
    'ignores unrelated, failed, mismatched, or prose-only results (%j)',
    async (override) => {
      const send = vi.fn();
      await createBrowserLoginApprovalHandler(send).handle({
        ...event(),
        ...override,
      });
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('sends only one card across concurrent requests and retries within a turn', async () => {
    let finish!: () => void;
    const send = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const { handle } = createBrowserLoginApprovalHandler(send);
    const first = handle(event());
    const second = handle(event());
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);
    await handle(event());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a fresh card when the owner retries the same browser in a new turn', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { handle } = createBrowserLoginApprovalHandler(send);
    await handle(event(), { sessionKey: 'owner', runId: 'first-turn' });
    await handle(event(), { sessionKey: 'owner', runId: 'first-turn' });
    expect(send).toHaveBeenCalledTimes(1);
    await handle(event(), { sessionKey: 'owner', runId: 'retry-turn' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('clears delivery state when a turn ends, including turns without a run id', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { handle, endRun } = createBrowserLoginApprovalHandler(send);
    const ctx = { sessionKey: 'owner' };
    await handle(event(), ctx);
    await handle(event(), ctx);
    expect(send).toHaveBeenCalledTimes(1);
    endRun(ctx);
    await handle(event(), ctx);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not clear another active turn when one turn ends', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { handle, endRun } = createBrowserLoginApprovalHandler(send);
    const first = { sessionKey: 'owner', runId: 'first-turn' };
    const second = { sessionKey: 'owner', runId: 'second-turn' };
    await handle(event(), first);
    await handle(event(), second);
    endRun(first);
    await handle(event(), second);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reports delivery failure and allows a subsequent attempt', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('delivery failed'))
      .mockResolvedValueOnce(undefined);
    const { handle } = createBrowserLoginApprovalHandler(send);
    await expect(handle(event())).rejects.toThrow('delivery failed');
    await handle(event());
    expect(send).toHaveBeenCalledTimes(2);
  });
});
