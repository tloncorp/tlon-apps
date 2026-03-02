import { Attachment } from '@tloncorp/shared';
import * as logic from '@tloncorp/shared/logic';

type EditingPostLike = {
  content?: unknown;
  blob?: string | null;
};

type HydratedVideoBlock = Extract<
  ReturnType<typeof logic.convertContent>[number],
  { type: 'video' }
>;

export type HydratedVideoAttachment = Extract<Attachment, { type: 'video' }> & {
  localFile: string;
};

function getHydratedVideoBlocks(
  editingPost: EditingPostLike | null | undefined,
  enabled: boolean
): HydratedVideoBlock[] {
  if (!enabled || !editingPost?.content) {
    return [];
  }
  return logic
    .convertContent(editingPost.content, editingPost.blob)
    .filter((block): block is HydratedVideoBlock => block.type === 'video');
}

export function getHydratedVideoAttachments(
  editingPost: EditingPostLike | null | undefined,
  enabled: boolean
): HydratedVideoAttachment[] {
  return getHydratedVideoBlocks(editingPost, enabled).map((block) => ({
    type: 'video',
    localFile: block.src,
    size: -1,
    mimeType: undefined,
    name: block.alt,
    width: block.width,
    height: block.height,
  }));
}
