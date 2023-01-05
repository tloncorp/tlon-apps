import React from 'react';
import { Helmet } from 'react-helmet';
import { useChannelUnreadCounts } from '@/logic/useIsChannelUnread';
import { useSettingsState, SettingsState } from '@/state/settings';

const selMessagesFilter = (s: SettingsState) => ({
  messagesFilter: s.talk.messagesFilter,
});

export default function TalkHead() {
  const { messagesFilter } = useSettingsState(selMessagesFilter);
  const unreads = useChannelUnreadCounts({ scope: messagesFilter });

  return (
    <Helmet defer={false}>
      {unreads > 0 ? <title>{`(${unreads}) `}Talk</title> : <title>Talk</title>}
    </Helmet>
  );
}
