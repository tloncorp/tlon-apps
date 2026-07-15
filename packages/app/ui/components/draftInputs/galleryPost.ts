import type { PostSendOptions } from '@tloncorp/shared';
import type { Attachment, PostDataDraft } from '@tloncorp/shared/domain';

export function buildGalleryAttachmentPostDrafts({
  attachments,
  caption,
  channelId,
  channelType,
  editTargetPostId,
}: {
  attachments: Attachment[];
  caption: string;
  channelId: string;
  channelType: PostDataDraft['channelType'];
  editTargetPostId?: string;
}): PostDataDraft[] {
  const attachmentGroups = editTargetPostId
    ? [attachments]
    : attachments.map((attachment) => [attachment]);

  return attachmentGroups.map((postAttachments) => {
    const imageAttachment = postAttachments.find(
      (attachment) => attachment.type === 'image'
    );
    const draftBase = {
      channelId,
      content: caption ? [caption] : [],
      attachments: postAttachments,
      channelType,
      replyToPostId: null,
      image:
        imageAttachment?.type === 'image'
          ? imageAttachment.file.uri
          : undefined,
    };

    return editTargetPostId
      ? {
          ...draftBase,
          isEdit: true,
          editTargetPostId,
        }
      : {
          ...draftBase,
          isEdit: false,
        };
  });
}

export async function enqueueGalleryAttachmentPosts(
  drafts: PostDataDraft[],
  sendPost: (draft: PostDataDraft, options?: PostSendOptions) => Promise<void>
): Promise<void> {
  const completions: Promise<void>[] = [];

  for (const draft of drafts) {
    let resolveEnqueued: (() => void) | undefined;
    const enqueued = new Promise<void>((resolve) => {
      resolveEnqueued = resolve;
    });
    const markEnqueued = () => resolveEnqueued?.();
    const completion = sendPost(draft, { onEnqueued: markEnqueued });

    // A send can exit early (for example, if its channel disappears) before
    // reaching the queue. In that case, continue the batch after it settles
    // rather than leaving the remaining selections blocked forever.
    void completion.then(markEnqueued, markEnqueued);
    await enqueued;
    completions.push(completion);
  }

  await Promise.all(completions);
}
