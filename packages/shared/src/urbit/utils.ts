import * as ub from './index';

type App = 'chat' | 'heap' | 'diary';

export function checkNest(nest: string) {
  if (nest.split('/').length !== 3) {
    console.error('Invalid nest:', nest);
  }
}

export function nestToFlag(nest: string): [App, string] {
  checkNest(nest);
  const [app, ...rest] = nest.split('/');

  return [app as App, rest.join('/')];
}

export function getBlockContent(block: ub.Block) {
  if (ub.isImage(block)) {
    return '[image]';
  } else if (ub.isCite(block)) {
    return '[ref]';
  } else if (ub.isHeader(block)) {
    return block.header.content.map(getInlineContent);
  } else if (ub.isCode(block)) {
    return block.code.code;
  } else if (ub.isListing(block)) {
    return getListingContent(block.listing);
  }
}

export function getListingContent(listing: ub.Listing): string {
  if (ub.isListItem(listing)) {
    return listing.item.map(getInlineContent).join(' ');
  } else {
    return listing.list.items.map(getListingContent).join(' ');
  }
}

export function getInlinesContent(inlines: ub.Inline[]): string {
  return inlines
    .map(getInlineContent)
    .filter((v) => v && v !== '')
    .join(' ');
}

export function getInlineContent(inline: ub.Inline): string {
  if (ub.isBold(inline)) {
    return inline.bold.map(getInlineContent).join(' ');
  } else if (ub.isItalics(inline)) {
    return inline.italics.map(getInlineContent).join(' ');
  } else if (ub.isLink(inline)) {
    return inline.link.content;
  } else if (ub.isStrikethrough(inline)) {
    return inline.strike.map(getInlineContent).join(' ');
  } else if (ub.isBlockquote(inline)) {
    return inline.blockquote.map(getInlineContent).join(' ');
  } else if (ub.isInlineCode(inline)) {
    return inline['inline-code'];
  } else if (ub.isBlockCode(inline)) {
    return inline.code;
  } else if (ub.isBreak(inline)) {
    return '';
  } else if (ub.isShip(inline)) {
    return inline.ship;
  } else if (ub.isTag(inline)) {
    return inline.tag;
  } else if (ub.isBlockReference(inline)) {
    return inline.block.text;
  } else if (ub.isTask(inline)) {
    return inline.task.content.map(getInlineContent).join(' ');
  } else {
    return inline;
  }
}
