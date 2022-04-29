import React from 'react';
import { ChatSeal } from '../../types/chat';
import ChatReaction from './ChatReaction';

interface ChatReactionsProps {
  seal: ChatSeal;
}

export const FEELS = {
  HAHA: '😆',
  WOW: '😮',
  FIRE: '🔥',
};

export default function ChatReactions({ seal }: ChatReactionsProps) {
  return (
    <div className="flex my-2 space-x-2">
      {Object.values(FEELS).map((feel) => (
        <ChatReaction key={feel} seal={seal} feel={feel} />
      ))}
    </div>
  );
}
