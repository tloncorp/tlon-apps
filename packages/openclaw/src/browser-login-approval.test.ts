import { describe, expect, it, vi } from 'vitest';

import { createBrowserLoginApprovalExecutor } from './browser-login-approval.js';

const input = {
  session_id: 'fresh-ivory-finch',
  form_id: '123e4567-e89b-42d3-a456-426614174000',
  record: { id: 'provider-item', revision: 1 },
  bindings: [{ sourceField: 'email', targetField: 'f0' }],
};
const ctx = { sessionKey: 'agent:main:tlon:direct:~ten' };
function setup() {
  const deps = {
    isPending: vi.fn(async () => false),
    useLogin: vi.fn(async () => ({
      metadata: {
        session_id: input.session_id,
        login: { status: 'approval_required' },
      },
      isError: false,
    })),
    sendHandoff: vi.fn(async () => undefined),
    warn: vi.fn(),
  };
  return { deps, execute: createBrowserLoginApprovalExecutor(deps) };
}

describe('saved login approval', () => {
  it('returns approval_pending only once the card has been sent', async () => {
    const { deps, execute } = setup();
    const send = Promise.withResolvers<undefined>();
    deps.sendHandoff.mockReturnValueOnce(send.promise);
    const finished = vi.fn();
    const invocation = execute(input, ctx).then((outcome) => {
      finished(outcome);
      return outcome;
    });
    await vi.waitFor(() =>
      expect(deps.sendHandoff).toHaveBeenCalledExactlyOnceWith(input, ctx)
    );
    expect(finished).not.toHaveBeenCalled();
    send.resolve(undefined);
    await expect(invocation).resolves.toMatchObject({
      details: { status: 'approval_pending' },
    });
  });

  it('refuses another request for a prepared form even after the first send fails', async () => {
    const { deps, execute } = setup();
    deps.sendHandoff.mockRejectedValueOnce(new Error('signed-private-token'));
    const failed = await execute(input, ctx);
    expect(failed.details.status).toBe('delivery_failed');
    expect(JSON.stringify(failed)).not.toContain('signed-private-token');
    expect(deps.warn).toHaveBeenCalledWith(
      'Could not send the saved-login approval card.'
    );
    await expect(
      execute(input, { sessionKey: 'later-conversation' })
    ).resolves.toMatchObject({
      details: { status: 'login_already_requested' },
    });
    expect(deps.useLogin).toHaveBeenCalledOnce();
    const fresh = { ...input, form_id: '223e4567-e89b-42d3-a456-426614174000' };
    await expect(execute(fresh, ctx)).resolves.toMatchObject({
      details: { status: 'approval_pending' },
    });
  });

  it('respects the existing secure-entry lock before requesting another login', async () => {
    const { deps, execute } = setup();
    deps.isPending.mockResolvedValueOnce(true);
    await expect(execute(input, ctx)).resolves.toMatchObject({
      details: { status: 'secure_entry_pending' },
    });
    expect(deps.useLogin).not.toHaveBeenCalled();
    expect(deps.sendHandoff).not.toHaveBeenCalled();
  });

  it('preserves legacy fields-based requests', async () => {
    const { deps, execute } = setup();
    const legacy = { session_id: input.session_id, fields: ['@e12'] };
    await expect(execute(legacy, ctx)).resolves.toMatchObject({
      details: { status: 'approval_pending' },
    });
    expect(deps.sendHandoff).toHaveBeenCalledExactlyOnceWith(legacy, ctx);
  });

  it('rejects a mismatched browser response before sending a card', async () => {
    const { deps, execute } = setup();
    deps.useLogin.mockResolvedValueOnce({
      metadata: {
        session_id: 'another-browser',
        login: { status: 'approval_required' },
      },
      isError: false,
    });
    await expect(execute(input, ctx)).resolves.toMatchObject({
      details: { status: 'login_unavailable' },
    });
    expect(deps.sendHandoff).not.toHaveBeenCalled();
  });
});
