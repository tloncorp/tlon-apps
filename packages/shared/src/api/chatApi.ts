import { poke } from "./urbit";

export const markChatRead = (whom: string) =>
  poke({
    app: "chat",
    mark: "chat-remark-action",
    json: {
      whom,
      diff: { read: null },
    },
  });
