import {
  List,
  ListItem,
  Listing,
  ListingBlock,
  Story,
  Verse,
} from '@tloncorp/shared/urbit/channel';
import { Inline } from '@tloncorp/shared/urbit/content';
import React from 'react';

import { renderComplexNestedList } from '../utils/markdown-lists';

/**
 * A specialized component for rendering properly nested lists with preservation
 * of the hierarchical structure (rather than flattening with indentation).
 */
export const NestedListRenderer: React.FC<{
  story: Story;
}> = ({ story }) => {
  // Main component entry point
  return (
    <div className="nested-list-container">
      {story.map((verse, i) => (
        <React.Fragment key={i}>{renderVerse(verse)}</React.Fragment>
      ))}
    </div>
  );
};

/**
 * Helper to render a Verse which could be either a block or inline
 */
function renderVerse(verse: Verse): React.ReactNode {
  // Handle block verses (like a ListingBlock)
  if ('block' in verse) {
    return renderBlock(verse.block);
  }

  // Handle inline verses
  if ('inline' in verse) {
    return (
      <div className="inline-verse">
        {verse.inline.map((inline, i) => (
          <React.Fragment key={i}>{renderInline(inline)}</React.Fragment>
        ))}
      </div>
    );
  }

  return null;
}

/**
 * Helper to render a Block which could be various types
 */
function renderBlock(block: any): React.ReactNode {
  // Handle listing blocks (our lists)
  if ('listing' in block) {
    return renderListing(block.listing);
  }

  // Other block types can be added as needed
  return null;
}

/**
 * Helper to render a Listing (List or ListItem)
 */
function renderListing(listing: Listing): React.ReactNode {
  // Handle List type (contains nested items)
  if ('list' in listing) {
    const { type, items } = listing.list;

    // Choose the appropriate list element based on type
    const ListElement = type === 'ordered' ? 'ol' : 'ul';

    // Render the list with its items
    return (
      <ListElement className={`list-${type}`}>
        {items.map((item, i) => (
          <li key={i}>{renderListing(item)}</li>
        ))}
      </ListElement>
    );
  }

  // Handle ListItem (contains inlines)
  if ('item' in listing) {
    return (
      <div className="list-item-content">
        {listing.item.map((inline, i) => (
          <React.Fragment key={i}>{renderInline(inline)}</React.Fragment>
        ))}
      </div>
    );
  }

  return null;
}

/**
 * Helper to render inline content (text, bold, italic, etc.)
 */
function renderInline(inline: Inline): React.ReactNode {
  // Handle plain text
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

  return null;
}

/**
 * Example component that demonstrates the usage
 */
export const ComplexNestedListExample: React.FC = () => {
  // Our complex nested list example
  const markdown = `
* List with **bold text** and *italic text*
  * Nested list with \`inline code\`
    * Deeply nested with [a link](https://example.com)
`;

  // Convert to properly structured Story with nested lists
  const story = renderComplexNestedList(markdown);

  return (
    <div className="example-container">
      <h2>Properly Nested List Example</h2>

      <h3>Markdown Source:</h3>
      <pre className="markdown-source">{markdown}</pre>

      <h3>Rendered Output (Proper Nesting):</h3>
      <div className="rendered-output">
        <NestedListRenderer story={story} />
      </div>

      <h3>How It Works:</h3>
      <p>
        This example properly preserves the hierarchical structure of nested
        lists using the List and ListItem types, rather than flattening with
        indentation.
      </p>
      <p>The key differences from the previous approach:</p>
      <ul>
        <li>Lists maintain parent-child relationships in the AST</li>
        <li>Each list item properly nests its children</li>
        <li>Rendering uses actual HTML list elements (ul/ol/li)</li>
        <li>Inline formatting is preserved within the nested structure</li>
      </ul>
    </div>
  );
};

export default NestedListRenderer;
