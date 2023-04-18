import React from 'react';
import { Helmet } from 'react-helmet';
import { useChannelUnreadCounts } from '@/logic/useIsChannelUnread';
import { useMessagesFilter } from '@/state/settings';

export default function TalkHead() {
  const messagesFilter = useMessagesFilter();
  const unreads = useChannelUnreadCounts({ scope: messagesFilter });

  return (
    <Helmet defer={false}>
      {unreads > 0 ? <title>{`(${unreads}) `}Talk</title> : <title>Talk</title>}
    </Helmet>
  );
}
