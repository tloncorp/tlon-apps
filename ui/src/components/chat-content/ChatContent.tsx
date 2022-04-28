import React from 'react';
import { MessageContent } from '../../types/chat';

type ChatContentProps = {
  content: MessageContent;
};

export default function ChatContent({ content }: ChatContentProps) {
  if (Array.isArray(content)) {
    return (
      <div>
        {content.map((contentItem) => {
          switch (contentItem.kind) {
            case 'image':
              return (
                <img
                  src={contentItem.source}
                  width={contentItem.size.width}
                  height={contentItem.size.height}
                  alt={contentItem.altText}
                />
              );
            default:
              throw new Error(`Unhandled message type: ${contentItem.kind}`);
          }
        })}
      </div>
    );
  }
  switch (content.kind) {
    case 'text':
      return <div>{content.contentText}</div>;
    default:
      throw new Error(`Unhandled message type: ${content.kind}`);
  }
}
