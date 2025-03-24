import { Story, Verse, VerseInline } from '@tloncorp/shared/urbit/channel';

import { markdownToStory } from './markdown';

/**
 * Version tracking for markdown rendering changes.
 * Increment this when making significant changes to how markdown is parsed.
 */
export const MARKDOWN_VERSION = 2; // 1 was original, 2 introduces proper nested lists

/**
 * Checks if a story uses the flat/indented list format vs the nested structure
 */
export function isLegacyListFormat(story: Story): boolean {
  if (!story || !Array.isArray(story)) {
    return false;
  }

  // Check for sequential inline verses with indented bullet points
  let foundBulletPoint = false;
  let foundIndentedBullet = false;

  for (let i = 0; i < story.length; i++) {
    const verse = story[i];

    if ('inline' in verse && verse.inline.length > 0) {
      const firstItem = verse.inline[0];

      // Check if this is a bullet point
      if (typeof firstItem === 'string') {
        if (firstItem === '• ' || firstItem.endsWith('. ')) {
          foundBulletPoint = true;
        } else if (
          firstItem.startsWith('  ') &&
          (firstItem.includes('• ') || firstItem.includes('. '))
        ) {
          foundIndentedBullet = true;
        }
      }
    }
  }

  // If we found both a bullet point and an indented bullet, it's likely using the legacy format
  return foundBulletPoint && foundIndentedBullet;
}

/**
 * Converts legacy indented list format to proper nested list format
 */
export function migrateListFormat(story: Story): Story {
  if (!isLegacyListFormat(story)) {
    return story;
  }

  // Extract original markdown from the story
  const markdownLines: string[] = [];

  for (const verse of story) {
    if ('inline' in verse) {
      // Get just the text content and reconstruct the markdown
      let line = '';

      for (const item of verse.inline) {
        if (typeof item === 'string') {
          line += item;
        } else if ('bold' in item && Array.isArray(item.bold)) {
          line += `**${item.bold.join('')}**`;
        } else if ('italics' in item && Array.isArray(item.italics)) {
          line += `*${item.italics.join('')}*`;
        } else if ('strike' in item && Array.isArray(item.strike)) {
          line += `~~${item.strike.join('')}~~`;
        } else if ('inline-code' in item) {
          line += `\`${item['inline-code']}\``;
        } else if ('link' in item) {
          line += `[${item.link.content}](${item.link.href})`;
        }
      }

      markdownLines.push(line);
    }
  }

  // Recreate markdown with proper formatting
  const markdown = markdownLines.join('\n');

  // Reparse the markdown with the updated parser
  return markdownToStory(markdown);
}

/**
 * Checks if content needs migration and handles converting if needed
 */
export function ensureLatestMarkdownFormat(story: Story): Story {
  // Check if we need to migrate list format
  if (isLegacyListFormat(story)) {
    return migrateListFormat(story);
  }

  return story;
}
