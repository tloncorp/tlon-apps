import { Story, Verse } from '@tloncorp/shared/urbit/channel';
import { Inline } from '@tloncorp/shared/urbit/content';
import React from 'react';

/**
 * A specialized component for rendering complex nested lists
 * that preserves inline formatting (bold, italic, code, links).
 *
 * The component accepts a Story AST that represents a nested list with
 * various inline formatting, and renders it as proper HTML.
 */
export const ComplexListRenderer: React.FC<{ story: Story }> = ({ story }) => {
  // Helper to render inline content (text, bold, italic, links, etc.)
  const renderInline = (inline: Inline): React.ReactNode => {
    // Handle string
    if (typeof inline === 'string') {
      return inline;
    }

    // Handle bold text
    if ('bold' in inline) {
      return <strong>{inline.bold.map(renderInline)}</strong>;
    }

    // Handle italic text
    if ('italics' in inline) {
      return <em>{inline.italics.map(renderInline)}</em>;
    }

    // Handle inline code
    if ('inline-code' in inline) {
      return <code>{inline['inline-code']}</code>;
    }

    // Handle links
    if ('link' in inline) {
      return (
        <a href={inline.link.href} target="_blank" rel="noopener noreferrer">
          {inline.link.content}
        </a>
      );
    }

    // Handle strikethrough
    if ('strike' in inline) {
      return <del>{inline.strike.map(renderInline)}</del>;
    }

    // Handle line breaks
    if ('break' in inline) {
      return <br />;
    }

    // Return null for unhandled types
    return null;
  };

  // Helper to render a verse (in our case, a list item line)
  const renderVerse = (verse: Verse): React.ReactNode => {
    if ('inline' in verse) {
      // This is a list item verse
      const inlines = verse.inline;

      // Parse the bullet/marker from the first inline element
      // The first element should be a string like "• " or "  • " with indentation
      const firstElement = inlines[0];
      const indentLevel =
        typeof firstElement === 'string'
          ? Math.floor(firstElement.length / 2) - 1 // Calculate based on spaces
          : 0;

      // Apply proper indentation style
      const indentStyle = {
        paddingLeft: `${indentLevel * 1.5}rem`,
        marginBottom: '0.25rem',
      };

      return (
        <div className="list-item" style={indentStyle}>
          {inlines.map((inline, i) => (
            <React.Fragment key={i}>{renderInline(inline)}</React.Fragment>
          ))}
        </div>
      );
    }

    // Handle block verses (not needed for our example)
    return null;
  };

  return (
    <div className="complex-list-container">
      {story.map((verse, i) => (
        <React.Fragment key={i}>{renderVerse(verse)}</React.Fragment>
      ))}
    </div>
  );
};

/**
 * Usage example:
 *
 * Import and use this component with the Story AST:
 *
 * ```tsx
 * import { markdownToStory } from '@tloncorp/app/utils/markdown';
 * import { ComplexListRenderer } from './ComplexListRenderer';
 *
 * const MyComponent = () => {
 *   const markdown = `
 *   * List with **bold text** and *italic text*
 *     * Nested list with \`inline code\`
 *       * Deeply nested with [a link](https://example.com)
 *   `;
 *
 *   const story = markdownToStory(markdown);
 *
 *   return (
 *     <div>
 *       <h2>Rendered Complex List:</h2>
 *       <ComplexListRenderer story={story} />
 *     </div>
 *   );
 * };
 * ```
 */
