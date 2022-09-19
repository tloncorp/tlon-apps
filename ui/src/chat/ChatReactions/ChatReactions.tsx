import React from 'react';
import { ChatSeal } from '../../types/chat';
import ChatReaction from './ChatReaction';

interface ChatReactionsProps {
  whom: string;
  seal: ChatSeal;
}

export default function ChatReactions({ whom, seal }: ChatReactionsProps) {
  return (
    <div className="my-2 flex space-x-2">
      {Object.entries(seal.feels).map(([ship, feel]) => (
        <ChatReaction
          key={feel}
          seal={seal}
          ship={ship}
          feel={feel}
          whom={whom}
        />
      ))}
    </div>
  );
}
