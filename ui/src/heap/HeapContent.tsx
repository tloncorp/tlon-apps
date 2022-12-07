import React from 'react';
import { Inline } from '@/types/content';
import {
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isStrikethrough,
  CurioContent,
} from '@/types/heap';

// eslint-disable-next-line import/no-cycle
import ContentReference from '@/components/References/ContentReference';

interface HeapContentProps {
  content: CurioContent;
  className?: string;
}

interface InlineContentProps {
  inline: Inline;
}

export function InlineContent({ inline }: InlineContentProps) {
  if (typeof inline === 'string') {
    return inline as unknown as JSX.Element;
  }

  if (isBold(inline)) {
    return (
      <strong>
        {inline.bold.map((s, k) => (
          <InlineContent key={k} inline={s} />
        ))}
      </strong>
    );
  }

  if (isItalics(inline)) {
    return (
      <em>
        {inline.italics.map((s, k) => (
          <InlineContent key={k} inline={s} />
        ))}
      </em>
    );
  }

  if (isStrikethrough(inline)) {
    return (
      <span className="line-through">
        {inline.strike.map((s, k) => (
          <InlineContent key={k} inline={s} />
        ))}
      </span>
    );
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
              <InlineContent key={item.toString() + index} inline={item} />
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

export default function HeapContent({ content, className }: HeapContentProps) {
  const inlineLength = content.inline.length;

  return (
    <div className={className}>
      {content.block.map((b, idx) => {
        if ('cite' in b) {
          return <ContentReference key={idx} cite={b.cite} />;
        }
        return '??';
      })}
      {inlineLength > 0 ? (
        <>
          {content.inline.map((inlineItem, index) => (
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
