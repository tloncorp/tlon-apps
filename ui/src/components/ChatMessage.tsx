import { daToUnix, udToDec } from '@urbit/api';
import React from 'react';
import bigInt from 'big-integer';
import { format } from 'date-fns';
import _ from 'lodash';
import f from 'lodash/fp';
import api from '../api';
import { ChatSeal, ChatWrit } from '../types/chat';
import Author from './Author';

interface ChatFeelProps {
  seal: ChatSeal;
}

const FEELS = {
  HAHA: '😆',
  WOW: '😮',
  FIRE: '🔥',
};

function ChatFeel(props: { feel: string; seal: ChatSeal }) {
  const { feel, seal } = props;

  const count = _.flow(
    f.pickBy((fe: string) => fe === feel),
    f.keys
  )(seal.feels).length;

  const addFeel = () => {
    api.poke({
      app: 'chat',
      mark: 'chat-action',
      json: {
        flag: '~zod/test',
        update: {
          time: '',
          diff: {
            'add-feel': {
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
      className="flex items-center space-x-2 rounded bg-gray-50 py-1 px-2 text-sm leading-tight text-gray-600"
    >
      <span>{feel}</span>
      <span>{count}</span>
    </div>
  );
}
function ChatFeels(props: ChatFeelProps) {
  const { seal } = props;

  return (
    <div className="flex space-x-2">
      {Object.values(FEELS).map((feel) => (
        <ChatFeel seal={seal} feel={feel} />
      ))}
    </div>
  );
}

interface ChatMessageProps {
  writ: ChatWrit;
}

export default function ChatMessage(props: ChatMessageProps) {
  const { writ } = props;
  const { seal, memo } = writ;

  const onDelete = () => {
    api.poke({
      app: 'chat',
      mark: 'chat-action',
      json: {
        flag: '~zod/test',
        update: {
          time: '',
          diff: {
            del: writ.seal.time,
          },
        },
      },
    });
  };

  const time = new Date(daToUnix(bigInt(udToDec(seal.time))));

  return (
    <div className="flex flex-col space-y-3 rounded-md">
      <div className="flex">
        <div className="text-mono flex grow items-center space-x-2">
          <Author ship={memo.author} />
          <div className="text-gray text-xs font-semibold">
            {format(time, 'HH:mm')}
          </div>
        </div>
        <button className="rounded border px-2" onClick={onDelete}>
          Delete
        </button>
      </div>
      <div>{memo.content}</div>
      <ChatFeels seal={seal} />
    </div>
  );
}
