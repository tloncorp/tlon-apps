import React, { useState } from 'react';

import { markdownToStory } from '../utils/markdown';
import { ComplexListRenderer } from './ComplexListRenderer';

/**
 * An example component that demonstrates using the ComplexListRenderer
 * with markdown input and showing the resulting structure.
 */
const ComplexNestedListExample: React.FC = () => {
  // Default markdown example with complex nesting and formatting
  const defaultMarkdown = `
* List with **bold text** and *italic text*
  * Nested list with \`inline code\`
    * Deeply nested with [a link](https://example.com)
  `;

  const [markdown, setMarkdown] = useState(defaultMarkdown);
  const story = markdownToStory(markdown);

  return (
    <div className="complex-list-example">
      <h2>Complex Nested List Example</h2>

      <div className="editor-section">
        <h3>Markdown Input</h3>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={8}
          className="markdown-editor"
          style={{
            width: '100%',
            padding: '0.5rem',
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div className="output-section">
        <h3>Rendered Output</h3>
        <div
          className="output-container"
          style={{
            padding: '1rem',
            border: '1px solid #eee',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <ComplexListRenderer story={story} />
        </div>
      </div>

      <div className="ast-section">
        <h3>AST Structure</h3>
        <pre
          style={{
            padding: '1rem',
            border: '1px solid #eee',
            borderRadius: '4px',
            backgroundColor: '#f6f8fa',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '0.9rem',
          }}
        >
          {JSON.stringify(story, null, 2)}
        </pre>
      </div>

      <div className="explanation-section">
        <h3>How It Works</h3>
        <p>
          This example demonstrates how to convert Markdown text into the Story
          AST format and render it with proper formatting and nesting.
        </p>
        <ol>
          <li>
            The markdown is processed by <code>markdownToStory()</code> into a
            structured AST
          </li>
          <li>
            Each list item becomes a <code>VerseInline</code> object with proper
            indentation
          </li>
          <li>
            Inline formatting (bold, italic, code, links) is preserved in the
            AST
          </li>
          <li>
            The <code>ComplexListRenderer</code> component recursively renders
            the AST
          </li>
        </ol>
      </div>
    </div>
  );
};

export default ComplexNestedListExample;
