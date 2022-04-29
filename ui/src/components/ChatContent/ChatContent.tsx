import React from 'react';
import { ChatMessage, isBold, isItalics, isLink } from '../../types/chat';

interface ChatContentProps {
  content: ChatMessage;
}

export default function ChatContent({ content }: ChatContentProps) {
  const inlineLength = content.inline.length;

  if (inlineLength) {
    return (
      <div>
        {content.inline.map((contentItem, index) => {
          const key = `${contentItem.toString}-${index}`;
          const space = inlineLength - 1 === index ? null : <span>&nbsp;</span>;

          if (typeof contentItem === 'string') {
            return (
              <span key={key}>
                {contentItem} {space}
              </span>
            );
          }

          if (isBold(contentItem)) {
            return (
              <b key={key}>
                {contentItem.bold} {space}
              </b>
            );
          }

          if (isItalics(contentItem)) {
            return (
              <i key={key}>
                {contentItem.italics} {space}
              </i>
            );
          }

          if (isLink(contentItem)) {
            return (
              <a
                target="_blank"
                rel="noreferrer"
                href={contentItem.href}
                key={key}
              >
                {contentItem.href} {space}
              </a>
            );
          }

          throw new Error(
            `Unhandled message type: ${JSON.stringify(contentItem)}`
          );
        })}
      </div>
    );
  }

  if (content.block) {
    return (
      <div>
        {content.block.map((contentItem, index) => (
          <div key={`${contentItem.bock}-${index}`}>{contentItem.block}</div>
        ))}
      </div>
    );
  }

  throw new Error(`Unhandled message type: ${JSON.stringify(content)}`);
}
