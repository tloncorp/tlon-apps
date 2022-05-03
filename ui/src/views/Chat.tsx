import React, { useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatMessage from '../components/ChatMessage/ChatMessage';
import api from '../api';
import { useChatState, useMessagesForChat } from '../state/chat';
import Layout from '../components/layout/Layout';

const DEF_FLAG = '~zod/test';

export default function Chat() {
  const messages = useMessagesForChat(DEF_FLAG);

  useEffect(() => {
    useChatState.getState().initialize('~zod/test');

    return () => {
      api.reset();
    };
  }, []);

  return (
    <Layout
      footer={
        <div className="p-4">
          <ChatInput flag={DEF_FLAG} />
        </div>
      }
      main={
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
                const writDay = new Date(
                  daToUnix(bigInt(udToDec(writ.seal.time)))
                );
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
                    writ={writ}
                    newAuthor={newAuthor}
                    newDay={newDay}
                  />
                );
              })}
          </div>
        </div>
      }
    />
  );
}
