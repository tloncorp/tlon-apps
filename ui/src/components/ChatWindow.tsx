import React, { useEffect } from 'react';
import _ from 'lodash';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useMessagesForChat, useChatState } from '../state/chat';
import ChatMessage from './ChatMessage/ChatMessage';

export default function ChatWindow({ flag }: { flag: string }) {
  const messages = useMessagesForChat(flag);

  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  return (
    <div className="flex h-full w-full flex-col overflow-auto px-4">
      <div className="mt-auto flex flex-col justify-end">
        {messages
          .keys()
          .reverse()
          .map((key, index) => {
            const writ = messages.get(key);
            const lastWrit =
              index > 0
                ? messages.get(messages.keys().reverse()[index - 1])
                : undefined;
            const newAuthor = lastWrit
              ? writ.memo.author !== lastWrit.memo.author
              : true;
            const writDay = new Date(daToUnix(bigInt(udToDec(writ.seal.time))));
            const lastWritDay = lastWrit
              ? new Date(daToUnix(bigInt(udToDec(lastWrit.seal.time))))
              : undefined;
            const newDay =
              lastWrit && lastWritDay
                ? differenceInDays(writDay, lastWritDay) > 0
                : false;
            return (
              <ChatMessage
                key={writ.seal.time}
                flag={flag}
                writ={writ}
                newAuthor={newAuthor}
                newDay={newDay}
              />
            );
          })}
      </div>
    </div>
  );
}
