import { decToUd } from "@urbit/api";
import React from "react";
import _ from "lodash";
import f from "lodash/fp";
import api from "../api";
import { ChatSeal, ChatWrit } from "../types/chat";

interface ChatFeelProps {
  seal: ChatSeal;
}

const FEELS = {
  HAHA: "😆",
  WOW: "😮",
  FIRE: "🔥",
};

function ChatFeel(props: { feel: string; seal: ChatSeal }) {
  const { feel, seal } = props;

  const count = _.flow(
    f.pickBy((f: string) => f == feel),
    f.keys
  )(seal.feels).length;
  console.log(count);

  const addFeel = () => {
    api.poke({
      app: "chat",
      mark: "chat-action",
      json: {
        flag: "~zod/test",
        update: {
          time: "",
          diff: {
            "add-feel": {
              time: seal.time,
              feel,
              ship: `~${window.ship}`,
            },
          },
        },
      },
    });
  };

  return (
    <div
      onClick={addFeel}
      className="flex space-x-2 items-center border px-2 py-1"
    >
      <span>{feel}</span>
      <span>{count}</span>
    </div>
  );
}
function ChatFeels(props: ChatFeelProps) {
  const { seal } = props;

  return (
    <div className="flex">
      {Object.values(FEELS).map((feel) => (
        <ChatFeel seal={seal} feel={feel} />
      ))}
    </div>
  );
}

interface ChatMessageProps {
  writ: ChatWrit;
}

export function ChatMessage(props: ChatMessageProps) {
  const { writ } = props;
  const { seal, memo } = writ;

  const onDelete = () => {
    api.poke({
      app: "chat",
      mark: "chat-action",
      json: {
        flag: "~zod/test",
        update: {
          time: "",
          diff: {
            del: writ.seal.time,
          },
        },
      },
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex space-between">
        <div className="flex text-mono space-x-2">
          <div>{memo.author}</div>
          <div>{seal.time}</div>
        </div>
        <button onClick={onDelete}>Delete</button>
      </div>
      <div>{memo.content}</div>
      <ChatFeels seal={seal} />
    </div>
  );
}
