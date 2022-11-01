import React from 'react';
// import { useReconnect } from '@/state/local';
import api from '@/api';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { useGroupState } from '@/state/groups';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import useHarkState from '@/state/hark';
import { useSettingsState } from '@/state/settings';
import useContactState from '@/state/contact';
import {
  useErrorCount,
  useLocalState,
  useSubscriptionStatus,
} from '@/state/local';

export default function DisconnectNotice() {
  // const reconnect = useReconnect();
  const errorCount = useErrorCount();
  const subscription = useSubscriptionStatus();

  function onClick() {
    if (errorCount < 3) {
      useLocalState.setState({ subscription: 'reconnecting' });
      useGroupState.getState().start();
      useChatState.getState().start();
      useHeapState.getState().start();
      useDiaryState.getState().start();

      useChatState.getState().fetchDms();
      useHarkState.getState().start();
      const { initialize: settingsInitialize, fetchAll } =
        useSettingsState.getState();
      settingsInitialize(api);
      fetchAll();

      useContactState.getState().initialize(api);
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        {subscription === 'reconnecting' ? (
          <span>Reconnecting...</span>
        ) : (
          <span className="mr-1">You are currently offline.</span>
        )}
      </div>
      {subscription === 'reconnecting' ? null : (
        <button className="py-1 px-2" onClick={onClick}>
          Reconnect
        </button>
      )}
    </div>
  );
}
