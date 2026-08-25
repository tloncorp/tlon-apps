import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { PendingApprovalView } from 'openclaw/plugin-sdk/approval-handler-runtime';
import type { ExecApprovalRequest } from 'openclaw/plugin-sdk/approval-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./urbit/api-client.js', () => ({
  withAuthenticatedTlonApi: vi.fn(async (_params, callback) => callback()),
}));

vi.mock('./urbit/send.js', () => ({
  sendChannelPost: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~bus/channel-message',
  })),
  sendDm: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~bus/dm-message',
    sentAt: Date.now(),
  })),
}));

const cfg = {
  channels: {
    tlon: {
      ship: '~bus',
      url: 'http://localhost:8080',
      code: 'lidlut-tabwed-pillex-ridrup',
      ownerShip: '~zod',
    },
  },
} as OpenClawConfig;

const request: ExecApprovalRequest = {
  id: 'approval-1',
  request: {
    command: 'echo ok',
    host: 'gateway',
    turnSourceChannel: 'tlon',
    turnSourceTo: 'tlon:~ten',
    turnSourceAccountId: 'default',
  },
  createdAtMs: Date.now(),
  expiresAtMs: Date.now() + 60_000,
};

const view: PendingApprovalView = {
  approvalId: request.id,
  approvalKind: 'exec',
  phase: 'pending',
  title: 'Exec Approval Required',
  description: 'A command needs your approval.',
  metadata: [{ label: 'Host', value: 'gateway' }],
  commandText: 'echo ok',
  host: 'gateway',
  actions: [
    {
      decision: 'allow-once',
      label: 'Allow Once',
      style: 'success',
      command: '/approve approval-1 allow-once',
    },
  ],
  expiresAtMs: request.expiresAtMs,
};

describe('Tlon approval native runtime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delivers the pending A2UI card to an owner DM and threads the result', async () => {
    const { tlonApprovalNativeRuntime } =
      await import('./approval-handler.runtime.js');
    const { sendDm } = await import('./urbit/send.js');

    const pendingPayload =
      await tlonApprovalNativeRuntime.presentation.buildPendingPayload({
        cfg,
        request,
        view,
        nowMs: Date.now(),
      } as never);
    const prepared = await tlonApprovalNativeRuntime.transport.prepareTarget({
      cfg,
      accountId: 'default',
      plannedTarget: { target: { to: '~zod' } },
    } as never);
    expect(prepared).not.toBeNull();

    const entry = await tlonApprovalNativeRuntime.transport.deliverPending({
      cfg,
      preparedTarget: prepared!.target,
      pendingPayload,
    } as never);
    expect(entry).toEqual({
      accountId: 'default',
      to: '~zod',
      messageId: '~bus/dm-message',
    });
    expect(sendDm).toHaveBeenCalledWith(
      expect.objectContaining({
        fromShip: '~bus',
        toShip: '~zod',
        blob: expect.stringContaining('"type":"a2ui"'),
      })
    );

    await tlonApprovalNativeRuntime.transport.updateEntry!({
      cfg,
      entry,
      payload: { text: 'Decision: allow-once' },
      phase: 'resolved',
    } as never);
    expect(sendDm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        replyToId: '~bus/dm-message',
        text: 'Decision: allow-once',
      })
    );
  });
});
