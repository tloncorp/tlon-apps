import React from 'react';
import {
  ChatInline,
  ChatMessage,
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
} from '../../types/chat';

interface ChatContentProps {
  content: ChatMessage;
}

interface InlineContentProps {
  content: ChatInline;
}

export function InlineContent({ content }: InlineContentProps) {
  if (typeof content === 'string') {
    return <span>{content}</span>;
  }

  if (isBold(content)) {
    return (
      <strong>
        {typeof content.bold === 'object' ? (
          <InlineContent content={content.bold} />
        ) : (
          content.bold
        )}
      </strong>
    );
  }

  if (isItalics(content)) {
    return (
      <em>
        {typeof content.italics === 'object' ? (
          <InlineContent content={content.italics} />
        ) : (
          content.italics
        )}
      </em>
    );
  }

  if (isLink(content)) {
    const containsProtocol = content.link.href.match(/https?:\/\//);
    return (
      <a
        target="_blank"
        rel="noreferrer"
        href={containsProtocol ? content.link.href : `//${content.link.href}`}
      >
        {content.link.content || content.link.href}
      </a>
    );
  }

  if (isBlockquote(content)) {
    return (
      <blockquote className="leading-6">
        {Array.isArray(content.blockquote)
          ? content.blockquote.map((item, index) => (
              <InlineContent key={item.toString() + index} content={item} />
            ))
          : content.blockquote}
      </blockquote>
    );
  }

  if (isInlineCode(content)) {
    return <code>{content['inline-code']}</code>;
  }

  if (isBreak(content)) {
    return <br />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(content)}`);
}

export function BlockContent({ content }: ChatContentProps) {
  return (
    <div>
      {content.block.map((contentItem, index) => (
        <div key={`${contentItem.bock}-${index}`}>{contentItem.block}</div>
      ))}
    </div>
  );
}

export default function ChatContent({ content }: ChatContentProps) {
  const inlineLength = content.inline.length;
  const blockLength = content.block.length;

  return (
    <div>
      {blockLength > 0 ? <BlockContent content={content} /> : null}
      {inlineLength > 0 ? (
        <>
          {content.inline.map((contentItem, index) => (
            <InlineContent
              key={`${contentItem.toString()}-${index}`}
              content={contentItem}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
