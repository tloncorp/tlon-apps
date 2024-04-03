import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { useContacts, useGroup } from '../contexts';

export default function useChannelTitle(channel: db.Channel) {
  const group = useGroup(channel.groupId || '');

  const generateTitleFromMembers = useCallback((members: db.GroupMember[]) => {
    const contacts = useContacts();
    return members
      .map(
        (m) =>
          contacts.find((c) => c.id === m.contactId)?.nickname ||
          contacts.find((c) => c.id === m.contactId)?.id
      )
      .join(', ');
  }, []);

  const title = useMemo(
    () =>
      channel.title
        ? channel.title
        : group && group.members
          ? generateTitleFromMembers(group.members)
          : 'Channel',
    [channel]
  );

  return title;
}
