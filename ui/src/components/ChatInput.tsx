import React, { ChangeEvent, useCallback, useState } from "react";
import api from "../api";
import { ChatMemo } from "../types/chat";

export function ChatInput(props: {}) {
  const [value, setValue] = useState<string>("");

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const onSubmit = useCallback(() => {
    const memo: ChatMemo = {
      author: `~${window.ship}`,
      sent: Date.now(),
      content: value,
    };
    api.poke({
      app: "chat",
      mark: "chat-action",
      json: {
        flag: "~zod/test",
        update: {
          time: "",
          diff: {
            add: memo,
          },
        },
      },
    });
    setValue('');
  }, [value]);

  return (
    <div className="flex">
      <input type="text" value={value} onChange={onChange} />
      <button type="button" onClick={onSubmit}>
        Submit!
      </button>
    </div>
  );
}
