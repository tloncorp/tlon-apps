import React from 'react';
import { MessageContent } from '../../types/chat';

type ChatContentProps = {
  content: MessageContent;
};

export default function ChatContent({ content }: ChatContentProps) {
  if (Array.isArray(content)) {
    return (
      <div>
        {content.map((e) => {
          switch (e.kind) {
            case 'image':
              return (
                <img
                  src={e.source}
                  width={e.size.width}
                  height={e.size.height}
                  alt={e.altText}
                />
              );
            default:
              throw new Error(`Unhandled message type: ${e.kind}`);
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
