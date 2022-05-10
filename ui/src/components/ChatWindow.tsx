import React, { useEffect } from 'react';
import _ from 'lodash';
import { Outlet } from 'react-router';
import ChatInput from './ChatInput/ChatInput';
import { useMessagesForChat, useChatPerms, useChatState } from '../state/chat';
import { useRouteGroup, useVessel } from '../state/groups';
import Layout from './layout/Layout';
import ChatMessages from './ChatMessages';

export default function ChatWindow(props: { flag: string }) {
  const { flag } = props;
  const groupFlag = useRouteGroup();

  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;

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
              <ChatMessages flag={flag} />
            </div>
          </div>
        }
      />
      <Outlet />
    </div>
  );
}
