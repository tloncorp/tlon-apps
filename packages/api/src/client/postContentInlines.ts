import * as ub from '../urbit';
import type { InlineData } from './postContent';

/**
 * Convert a list of wire-format `ub.Inline` values to local `InlineData[]`.
 * Lives in its own file so that `extractTables.ts` (called from
 * `convertContent` in `postContent.ts`) can import it without creating a
 * cycle through `postContent.ts`.
 */
export function convertInlineContent(inlines: ub.Inline[]): InlineData[] {
  const nodes: InlineData[] = [];
  inlines.forEach((inline, i) => {
    if (typeof inline === 'string') {
      nodes.push({
        type: 'text',
        text: inline,
      });
    } else if (ub.isBold(inline)) {
      nodes.push({
        type: 'style',
        style: 'bold',
        children: convertInlineContent(inline.bold),
      });
    } else if (ub.isItalics(inline)) {
      nodes.push({
        type: 'style',
        style: 'italic',
        children: convertInlineContent(inline.italics),
      });
    } else if (ub.isStrikethrough(inline)) {
      nodes.push({
        type: 'style',
        style: 'strikethrough',
        children: convertInlineContent(inline.strike),
      });
    } else if (ub.isInlineCode(inline)) {
      nodes.push({
        type: 'style',
        style: 'code',
        children: [{ type: 'text', text: inline['inline-code'] }],
      });
    } else if (ub.isLink(inline)) {
      nodes.push({
        type: 'link',
        href: inline.link.href,
        text: inline.link.content ?? inline.link.href,
      });
    } else if (ub.isBreak(inline)) {
      // Most content has a final line break after it -- we don't want to render it.
      if (i !== inlines.length - 1) {
        nodes.push({
          type: 'lineBreak',
        });
      }
    } else if (ub.isShip(inline)) {
      nodes.push({
        type: 'mention',
        contactId: inline.ship,
      });
    } else if (ub.isSect(inline)) {
      nodes.push({
        type: 'groupMention',
        group: !inline.sect ? 'all' : inline.sect,
      });
    } else if (ub.isTask(inline)) {
      nodes.push({
        type: 'task',
        checked: inline.task.checked,
        children: convertInlineContent(inline.task.content),
      });
    } else {
      console.warn('Unhandled inline type:', { inline });
      nodes.push({
        type: 'text',
        text: 'Unknown content type',
      });
    }
  });
  return nodes;
}
