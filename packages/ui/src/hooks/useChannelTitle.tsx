import * as client from '@tloncorp/shared/dist/client';
import { useCallback, useMemo } from 'react';

import { useContacts } from '../contexts';

export default function useChannelTitle(channel: client.Channel) {
  const generateTitleFromMembers = useCallback(
    (members: client.GroupMember[]) => {
      const contacts = useContacts();
      return members
        .map((m) => contacts[m.id].nickname || contacts[m.id].id)
        .join(', ');
    },
    []
  );

  const title = useMemo(
    () =>
      channel.title
        ? channel.title
        : channel.group && channel.group.members
          ? generateTitleFromMembers(channel.group.members)
          : 'Channel',
    [channel]
  );

  return title;
}
