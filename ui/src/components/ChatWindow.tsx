import React, { useEffect } from 'react';
import _ from 'lodash';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import ChatInput from './ChatInput/ChatInput';
import { useMessagesForChat, useChatPerms, useChatState } from '../state/chat';
import { useRouteGroup, useVessel } from '../state/groups';
import ChatMessage from './ChatMessage/ChatMessage';
import Layout from './layout/Layout';
import ChatMessages from './ChatMessages';

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

  return (
    <Layout
      className="grow"
      footer={
        <div className="p-4">
          {canWrite ? (
            <ChatInput whom={flag} />
          ) : (
            <span>Cannot write to this channel</span>
          )}
        </div>
      }
      main={
        <div className="flex h-full w-full flex-col overflow-auto px-4">
          <div className="mt-auto flex flex-col justify-end">
            <ChatMessages messages={messages} whom={flag} />
          </div>
        </div>
      }
    />
  );
}
