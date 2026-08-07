import type { Story } from '@tloncorp/api';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
// (bun resolves it fine at runtime and in tests)
import { markdownToStory as apiMarkdownToStory } from '@tloncorp/api/client/markdown';

import { commandError } from './commands/command';

export type { Story } from '@tloncorp/api';
export type StoryVerse = Story[number];

type Inline = Extract<StoryVerse, { inline: unknown }>['inline'][number];
type Block = Extract<StoryVerse, { block: unknown }>['block'];
type Listing = Extract<Block, { listing: unknown }>['listing'];

function hasRenderableInline(inline: Inline): boolean {
  if (typeof inline === 'string') {
    return inline.trim() !== '';
  }
  if ('break' in inline) {
    return false;
  }
  if (
    'ship' in inline ||
    'sect' in inline ||
    'inline-code' in inline ||
    'code' in inline ||
    'image' in inline
  ) {
    return true;
  }
  if ('link' in inline) {
    return inline.link.content.trim() !== '';
  }
  if ('bold' in inline) {
    return hasRenderableInlineList(inline.bold);
  }
  if ('italics' in inline) {
    return hasRenderableInlineList(inline.italics);
  }
  if ('strike' in inline) {
    return hasRenderableInlineList(inline.strike);
  }
  if ('blockquote' in inline) {
    return hasRenderableInlineList(inline.blockquote);
  }
  if ('task' in inline) {
    return hasRenderableInlineList(inline.task.content);
  }
  // Fail open: an unrecognized shape counts as renderable so future converter
  // arms can never cause a false refusal.
  return true;
}

function hasRenderableInlineList(inlines: Inline[]): boolean {
  return inlines.some((inline) => hasRenderableInline(inline));
}

function hasRenderableListing(listing: Listing): boolean {
  if ('item' in listing) {
    return hasRenderableInlineList(listing.item);
  }
  if ('list' in listing) {
    return (
      hasRenderableInlineList(listing.list.contents) ||
      listing.list.items.some((item) => hasRenderableListing(item))
    );
  }
  return true;
}

function hasRenderableBlock(block: Block): boolean {
  if ('image' in block || 'rule' in block || 'code' in block) {
    return true;
  }
  if ('header' in block) {
    return hasRenderableInlineList(block.header.content);
  }
  if ('listing' in block) {
    return hasRenderableListing(block.listing);
  }
  return true;
}

function hasRenderableStory(story: Story): boolean {
  return story.some((verse) => {
    if ('inline' in verse) {
      return hasRenderableInlineList(verse.inline);
    }
    if ('block' in verse) {
      return hasRenderableBlock(verse.block);
    }
    return true;
  });
}

function hasImageInline(inline: Inline): boolean {
  if (typeof inline === 'string') {
    return false;
  }
  if ('image' in inline) {
    return true;
  }
  if ('bold' in inline) {
    return hasImageInlineList(inline.bold);
  }
  if ('italics' in inline) {
    return hasImageInlineList(inline.italics);
  }
  if ('strike' in inline) {
    return hasImageInlineList(inline.strike);
  }
  if ('blockquote' in inline) {
    return hasImageInlineList(inline.blockquote);
  }
  if ('task' in inline) {
    return hasImageInlineList(inline.task.content);
  }
  return false;
}

function hasImageInlineList(inlines: Inline[]): boolean {
  return inlines.some((inline) => hasImageInline(inline));
}

function hasImageListing(listing: Listing): boolean {
  if ('item' in listing) {
    return hasImageInlineList(listing.item);
  }
  if ('list' in listing) {
    return (
      hasImageInlineList(listing.list.contents) ||
      listing.list.items.some((item) => hasImageListing(item))
    );
  }
  return false;
}

function hasImageBlock(block: Block): boolean {
  if ('header' in block) {
    return hasImageInlineList(block.header.content);
  }
  if ('listing' in block) {
    return hasImageListing(block.listing);
  }
  return false;
}

function hasImageInInlinePosition(story: Story): boolean {
  return story.some((verse) => {
    if ('inline' in verse) {
      return hasImageInlineList(verse.inline);
    }
    if ('block' in verse) {
      return hasImageBlock(verse.block);
    }
    return false;
  });
}

// Fail loud instead of posting nothing: the shared converter drops mdast
// nodes it can't represent (raw HTML blocks, reference-style links/images),
// so real input can convert to [] — or to an empty wrapper shell (e.g. a bold
// whose only child was a dropped link) that renders as nothing. Sending
// either would post/edit a blank.
//
// The backend wire schema only allows %image as a block — the inline JSON
// decoder has no image arm — so an image alongside text fails mark conversion
// and the whole poke is rejected. A standalone image line converts to a block
// verse and is fine.
export function markdownToStory(markdown: string): Story {
  const story: Story = apiMarkdownToStory(markdown);
  if (hasImageInInlinePosition(story)) {
    throw commandError(
      'images inside a text line are not supported by the backend; put the image on its own line or use --image'
    );
  }
  if (markdown.trim() !== '' && !hasRenderableStory(story)) {
    throw commandError(
      'message text produced no sendable content (unsupported Markdown, e.g. a raw HTML block or reference-style link); rephrase using inline Markdown'
    );
  }
  return story;
}
