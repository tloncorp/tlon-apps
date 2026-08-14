import { describe, expect, test, vi } from 'vitest';

import { lookupCachedMessage } from './history.js';
import { recordSentTlonReply } from './output.js';

describe('recordSentTlonReply', () => {
  test('records group output without adding a DM cache entry', () => {
    const recordOutput = vi.fn();
    const outputId = `group-output-${Date.now().toString(36)}`;
    const senderShip = `~group-${Date.now().toString(36)}`;

    recordSentTlonReply({
      botShipName: '~zod',
      contextLenses: { recordOutput },
      deliveredMessageCount: 1,
      groupChannel: 'chat/~ten/general',
      isGroup: true,
      lensId: 'group-lens',
      outputMessageId: outputId,
      replyBlob: undefined,
      replyPreview: 'group reply',
      replyText: 'group reply',
      senderShip,
    });

    expect(recordOutput).toHaveBeenCalledWith(
      'group-lens',
      expect.objectContaining({
        messageId: outputId,
        conversationId: 'chat/~ten/general',
        kind: 'channel',
      })
    );
    expect(lookupCachedMessage(`dm/${senderShip}`, outputId)).toBeUndefined();
  });

  test('records DM output and adds its send-time cache entry', () => {
    const recordOutput = vi.fn();
    const outputId = `dm-output-${Date.now().toString(36)}`;
    const senderShip = `~dm-${Date.now().toString(36)}`;

    recordSentTlonReply({
      botShipName: '~zod',
      contextLenses: { recordOutput },
      deliveredMessageCount: 2,
      groupChannel: undefined,
      isGroup: false,
      lensId: 'dm-lens',
      outputMessageId: outputId,
      replyBlob: undefined,
      replyPreview: 'DM reply',
      replyText: 'DM reply',
      senderShip,
    });

    expect(recordOutput).toHaveBeenCalledWith(
      'dm-lens',
      expect.objectContaining({
        messageId: outputId,
        conversationId: senderShip,
        kind: 'dm',
      })
    );
    expect(lookupCachedMessage(`dm/${senderShip}`, outputId)).toMatchObject({
      author: '~zod',
      content: 'DM reply',
    });
  });
});
