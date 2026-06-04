import { markdownToStory, storyToMarkdown } from '@tloncorp/shared';

import {
  Mention,
  extractMentionsFromSentinelText,
  injectInlinesIntoStory,
  replaceMentionSpansWithSentinels,
  sentinelizeStory,
} from './liveMarkdownMentions';

// Seed editor text + tracked mentions from a story (e.g. when editing a post).
// Each mention inline is swapped for a sentinel, the story is rendered to
// markdown, then the sentinels are turned back into canonical mention text with
// their resulting positions recorded.
export function storyToTextAndMentions(story: unknown[]): {
  text: string;
  mentions: Mention[];
} {
  const { story: sentinelStory, inlines } = sentinelizeStory(story as never);
  const markdown = storyToMarkdown(sentinelStory as never);
  return extractMentionsFromSentinelText(markdown, inlines);
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
