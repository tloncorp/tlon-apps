import React from 'react';
import {
  HeapInline,
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isStrikethrough,
  CurioContent,
} from '@/types/heap';

interface HeapContentProps {
  content: CurioContent;
}

interface InlineContentProps {
  inline: HeapInline;
}

export function InlineContent({ inline }: InlineContentProps) {
  if (typeof inline === 'string') {
    return inline as unknown as JSX.Element;
  }

  if (isBold(inline)) {
    return <strong>{inline.bold}</strong>;
  }

  if (isItalics(inline)) {
    return <em>{inline.italics}</em>;
  }

  if (isStrikethrough(inline)) {
    return <span className="line-through">{inline.strike}</span>;
  }

  if (isLink(inline)) {
    const containsProtocol = inline.link.href.match(/https?:\/\//);
    return (
      <a
        target="_blank"
        rel="noreferrer"
        href={containsProtocol ? inline.link.href : `//${inline.link.href}`}
      >
        {inline.link.content || inline.link.href}
      </a>
    );
  }

  if (isBlockquote(inline)) {
    return (
      <blockquote className="leading-6">
        {Array.isArray(inline.blockquote)
          ? inline.blockquote.map((item, index) => (
              <InlineContent
                key={item.toString() + index}
                inline={item as HeapInline}
              />
            ))
          : inline.blockquote}
      </blockquote>
    );
  }

  if (isInlineCode(inline)) {
    return (
      <code>
        {typeof inline['inline-code'] === 'object' ? (
          <InlineContent inline={inline['inline-code']} />
        ) : (
          inline['inline-code']
        )}
      </code>
    );
  }

  if (isBreak(inline)) {
    return <br />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(inline)}`);
}

export default function HeapContent({ content }: HeapContentProps) {
  const inlineLength = content.length;

  return (
    <div className="leading-6">
      {inlineLength > 0 ? (
        <>
          {content.map((inlineItem, index) => (
            <InlineContent
              key={`${inlineItem.toString()}-${index}`}
              inline={inlineItem}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
