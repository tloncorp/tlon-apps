import type { JSONContent } from '@tloncorp/api/urbit';
import type { Attachment, ReferenceAttachment } from '@tloncorp/shared';

import { textAndMentionsToContent } from './helpers';

/** Chat drafts keep reference previews alongside the existing editor JSON. */
export type ChatDraft = JSONContent & {
  referenceAttachments?: ReferenceAttachment[];
};

export function toChatDraft(
  text: string,
  mentions: Parameters<typeof textAndMentionsToContent>[1],
  attachments: Attachment[]
): ChatDraft {
  return {
    ...textAndMentionsToContent(text, mentions),
    referenceAttachments: attachments.filter(
      (attachment): attachment is ReferenceAttachment =>
        attachment.type === 'reference'
    ),
  };
}
