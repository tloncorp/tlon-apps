import type { PostContent } from '@tloncorp/shared/logic';

export type ContentRenderItem =
  | { type: 'block'; block: PostContent[number] }
  | {
      type: 'action-button-row';
      actionButtons: Extract<
        PostContent[number],
        { type: 'action-button' }
      >['actionButton'][];
    };

export function groupActionButtonBlocks(
  content: PostContent
): ContentRenderItem[] {
  const out: ContentRenderItem[] = [];

  for (let index = 0; index < content.length; index++) {
    const block = content[index];

    if (block.type !== 'action-button') {
      out.push({ type: 'block', block });
      continue;
    }

    const actionButtons = [block.actionButton];

    let nextBlock = content[index + 1];
    while (nextBlock?.type === 'action-button') {
      actionButtons.push(nextBlock.actionButton);
      index++;
      nextBlock = content[index + 1];
    }

    out.push({
      type: 'action-button-row',
      actionButtons,
    });
  }

  return out;
}
