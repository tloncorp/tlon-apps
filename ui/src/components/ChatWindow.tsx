import React, { useEffect } from 'react';
import _ from 'lodash';
import { Outlet } from 'react-router';
import { useChatState } from '../state/chat';
import ChatMessages from './ChatMessages';

export default function ChatWindow({ flag }: { flag: string }) {
  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  return (
    <div className="flex h-full w-full flex-col overflow-auto px-4">
      <div className="mt-auto flex flex-col justify-end">
        <ChatMessages flag={flag} />
      </div>
    </div>
  );
}
