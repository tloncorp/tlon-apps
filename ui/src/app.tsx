import React, { useEffect, useState } from "react";
import { ChatWrit, ChatWrits } from "./types/chat";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import api from "./api";
import { useChatState, useMessagesForChat } from "./state/chat";

const scryMessages = {
  app: "chat",
  path: "/chat/~zod/test/fleet/newest/100",
};

export function App() {
  const messages = useMessagesForChat("~zod/test");
  console.log(messages);

  useEffect(() => {
    (async () => {
      console.log('initialize');
      useChatState.getState().initialize("~zod/test");
    })();

    return () => {
      api.reset();
    };
  }, []);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="max-w-md space-y-6 py-20">
        <h1 className="text-3xl font-bold text-blue">Welcome to homestead</h1>
        <p className="font-mono">
          Here&apos;s your urbit&apos;s installed apps:
        </p>
        <div>
          {messages &&
            messages.keys().reverse().map((key) => {
              const writ = messages.get(key);
              return <ChatMessage key={writ.seal.time} writ={writ} />;
            })}
        </div>
        <ChatInput />
      </div>
    </main>
  );
}
