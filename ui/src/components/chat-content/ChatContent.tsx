import React from 'react';
import { MessageContent } from '../../types/chat';

interface ChatContentProps {
  content: MessageContent;
}

export default function ChatContent({ content }: ChatContentProps) {
  if (Array.isArray(content)) {
    // This will handle the various content types that will be received as arrays.
    return (
      <div>
        {content.map((contentItem) => {
          switch (contentItem.kind) {
            case 'image':
              // This is just an example. This will be its own component soon.
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
    // We'll build out components for each type and return them here.
    case 'text':
      return <div>{content.contentText}</div>;
    default:
      throw new Error(`Unhandled message type: ${content.kind}`);
  }
}
