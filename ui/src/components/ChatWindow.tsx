import React, { useEffect } from 'react';
import _ from 'lodash';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { Outlet } from 'react-router';
import ChatInput from './ChatInput/ChatInput';
import { useMessagesForChat, useChatPerms, useChatState } from '../state/chat';
import { useRouteGroup, useVessel } from '../state/groups';
import ChatMessage from './ChatMessage/ChatMessage';
import Layout from './layout/Layout';

export default function ChatWindow(props: { flag: string }) {
  const { flag } = props;
  const groupFlag = useRouteGroup();
  const messages = useMessagesForChat(flag);

  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const keys = messages
    .keys()
    .reverse()
    .filter((k) => !messages.get(k)!.memo.replying);

  return (
    <div className="flex h-full w-full">
      <Layout
        className="grow"
        footer={
          <div className="p-4">
            {canWrite ? (
              <ChatInput flag={flag} />
            ) : (
              <span>Cannot write to this channel</span>
            )}
          </div>
        }
        main={
          <div className="flex h-full w-full flex-col overflow-auto px-4">
            <div className="mt-auto flex flex-col justify-end">
              {keys.map((key, index) => {
                const writ = messages.get(key);
                const lastWrit =
                  index > 0 ? messages.get(keys[index - 1]) : undefined;
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
      <Outlet />
    </div>
  );
}
