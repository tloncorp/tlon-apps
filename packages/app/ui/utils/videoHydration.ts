import * as logic from '@tloncorp/shared/logic';

type EditingPostLike = {
  content?: unknown;
  blob?: string | null;
};

export function getHydratedVideoBlocks(
  editingPost: EditingPostLike | null | undefined,
  enabled: boolean
) {
  if (!enabled || !editingPost?.content) {
    return [];
  }
  return logic
    .convertContent(editingPost.content, editingPost.blob)
    .filter(
      (
        block
      ): block is Extract<
        ReturnType<typeof logic.convertContent>[number],
        { type: 'video' }
      > => block.type === 'video'
    );
}
