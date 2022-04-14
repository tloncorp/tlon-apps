import React from "react";
import { ChatWrit } from "../types/chat";

interface ChatMessageProps {
  writ: ChatWrit;
}

export function ChatMessage(props: ChatMessageProps) {
  const { writ } = props;
  const { seal, memo } = writ;

  return (
    <div className="flex flex-col">
      <div className="flex text-mono space-x-2">
        <div>{memo.author}</div>
        <div>{seal.time}</div>
      </div>
      <div>{memo.content}</div>
    </div>
  );
}
