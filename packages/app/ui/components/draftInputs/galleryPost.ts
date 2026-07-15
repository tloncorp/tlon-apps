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

export async function sendGalleryAttachmentPostsSequentially(
  drafts: PostDataDraft[],
  sendPost: (draft: PostDataDraft) => Promise<void>
): Promise<void> {
  for (const draft of drafts) {
    await sendPost(draft);
  }
}
