import React from 'react';
import {
  ChatInline,
  ChatBlock,
  ChatMessage,
  isBlockquote,
  isBold,
  isBreak,
  isChatImage,
  isInlineCode,
  isItalics,
  isLink,
  isStrikethrough,
} from '../../types/chat';
import ChatContentImage from './ChatContentImage';

interface ChatContentProps {
  content: ChatMessage;
}

interface InlineContentProps {
  content: ChatInline;
}

interface BlockContentProps {
  content: ChatBlock;
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

  if (isStrikethrough(content)) {
    return (
      <span className="line-through">
        {typeof content.strike === 'object' ? (
          <InlineContent content={content.strike} />
        ) : (
          content.strike
        )}
      </span>
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
    return (
      <code>
        {typeof content['inline-code'] === 'object' ? (
          <InlineContent content={content['inline-code']} />
        ) : (
          content['inline-code']
        )}
      </code>
    );
  }

  if (isBreak(content)) {
    return <br />;
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(content)}`);
}

export function BlockContent({ content }: BlockContentProps) {
  if (isChatImage(content)) {
    return (
      <ChatContentImage
        src={content.image.src}
        height={content.image.height}
        width={content.image.width}
        altText={content.image.altText}
      />
    );
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(content)}`);
}

export default function ChatContent({ content }: ChatContentProps) {
  const inlineLength = content.inline.length;
  const blockLength = content.block.length;

  return (
    <div className="leading-6">
      {blockLength > 0 ? (
        <>
          {content.block.map((contentItem, index) => (
            <div
              key={`${contentItem.toString()}-${index}`}
              className="flex flex-col"
            >
              <BlockContent content={contentItem} />
            </div>
          ))}
        </>
      ) : null}
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
