import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./approval-presentation.js', () => ({
  buildTlonNativeApprovalPayload: vi.fn(() => ({
    text: 'Approval required.',
    blob: '[{"type":"a2ui"}]',
  })),
}));
vi.mock('./urbit/api-client.js', () => ({
  withAuthenticatedTlonApi: vi.fn(async (_params, callback) => callback()),
}));
vi.mock('./urbit/send.js', () => ({
  sendChannelPost: vi.fn(),
  sendDm: vi.fn(async () => ({
    channel: 'tlon',
    messageId: '~bus/approval',
  })),
}));
vi.mock('./urbit/story.js', () => ({ markdownToStory: vi.fn() }));

const cfg = {
  channels: {
    tlon: {
      ship: '~bus',
      url: 'http://localhost:8080',
      code: 'lidlut-tabwed-pillex-ridrup',
    },
  },
} as OpenClawConfig;

describe('Tlon approval runtime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delivers an approval card and replies with its resolution', async () => {
    const { tlonApprovalNativeRuntime } =
      await import('./approval-handler.runtime.js');
    const { sendDm } = await import('./urbit/send.js');
    const prepared = await tlonApprovalNativeRuntime.transport.prepareTarget({
      cfg,
      accountId: 'default',
      plannedTarget: { target: { to: '~zod' } },
    } as never);
    const entry = await tlonApprovalNativeRuntime.transport.deliverPending({
      cfg,
      preparedTarget: prepared!.target,
      pendingPayload: {
        text: 'Approval required.',
        blob: '[{"type":"a2ui"}]',
      },
    } as never);

    expect(entry).toEqual({
      accountId: 'default',
      to: '~zod',
      messageId: '~bus/approval',
    });
    await tlonApprovalNativeRuntime.transport.updateEntry!({
      cfg,
      entry,
      payload: { text: 'Decision: allow-once' },
    } as never);
    expect(sendDm).toHaveBeenLastCalledWith(
      expect.objectContaining({ replyToId: '~bus/approval' })
    );
  });
});
