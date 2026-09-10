import { markdownToStory, storyToMarkdown } from '@tloncorp/shared';

import {
  Mention,
  MentionInline,
  decodeSafeMarkdownEscapes,
  decodeWhitespaceEntities,
  extractMentionsFromSentinelText,
  injectInlinesIntoStory,
  replaceMentionSpansWithSentinels,
  sentinelizeStory,
} from './liveMarkdownMentions';

// Seed editor text + tracked mentions from a story (e.g. when editing a post).
// Each mention inline is swapped for a sentinel, the story is rendered to
// markdown, then the sentinels are turned back into canonical mention text with
// their resulting positions recorded.
export function storyToTextAndMentions(
  story: unknown[],
  displayFor?: (inline: MentionInline) => string
): {
  text: string;
  mentions: Mention[];
} {
  const { story: sentinelStory, inlines } = sentinelizeStory(story as never);
  // Decode entity-encoded whitespace so the editor shows real characters rather
  // than `&#x20;`, and drop backslash escapes that can't change re-parsing (e.g.
  // snake_case underscores). Significant whitespace and any remaining escapes
  // then follow normal markdown rules on save (the editor stays WYSIWYG-honest).
  const markdown = decodeSafeMarkdownEscapes(
    decodeWhitespaceEntities(storyToMarkdown(sentinelStory as never))
  );
  return extractMentionsFromSentinelText(markdown, inlines, displayFor);
}

// Build a story from editor text + tracked mentions. Markdown formatting is
// parsed normally (mentions OFF so typed `~ship`/`@role` stay plain text), and
// the tracked mention spans are injected back as ship/sect inlines.
export function textAndMentionsToStory(
  text: string,
  mentions: Mention[]
): unknown[] {
  const { text: sentinelText, inlines } = replaceMentionSpansWithSentinels(
    text,
    mentions
  );
  const story = markdownToStory(sentinelText, {
    parseMentions: false,
  }) as unknown as never;
  return injectInlinesIntoStory(story, inlines);
}
