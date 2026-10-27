import { sanitizeAssistantVisibleTextWithProfile } from 'openclaw/plugin-sdk/text-chunking';

import type { ContextLensRegistry } from '../context-lens.js';
import { cacheMessage } from './history.js';

export function recordSentTlonReply({
  botShipName,
  contextLenses,
  deliveredMessageCount,
  groupChannel,
  isGroup,
  lensId,
  outputMessageId,
  replyBlob,
  replyPreview,
  replyText,
  senderShip,
}: {
  botShipName: string;
  contextLenses: Pick<ContextLensRegistry, 'recordOutput'>;
  deliveredMessageCount: number;
  groupChannel: string | undefined;
  isGroup: boolean;
  lensId: string;
  outputMessageId: string | null;
  replyBlob: string | undefined;
  replyPreview: string;
  replyText: string;
  senderShip: string;
}): void {
  if (!outputMessageId) {
    return;
  }

  if (!isGroup) {
    cacheMessage(`dm/${senderShip}`, {
      author: botShipName,
      content: replyText,
      timestamp: Date.now(),
      id: outputMessageId,
      blob: replyBlob,
      origin: 'create',
    });
  }

  contextLenses.recordOutput(lensId, {
    messageId: outputMessageId,
    conversationId: isGroup ? (groupChannel ?? '') : senderShip,
    kind: isGroup ? 'channel' : 'dm',
    sentAt: Date.now(),
    preview: replyPreview,
    chunkIndex: deliveredMessageCount - 1,
  });
}

/**
 * Strips internal tool-call scaffolding from reply text before it is posted.
 * Tool payloads are intentional progress summaries, so they use the
 * tool-progress profile, which keeps their trace lines.
 */
export function sanitizeTlonReplyText(text: string, kind: string): string {
  return sanitizeAssistantVisibleTextWithProfile(
    text,
    kind === 'tool' ? 'tool-progress' : 'delivery'
  );
}
