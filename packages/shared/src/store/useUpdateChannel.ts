import { useCallback } from 'react';

import * as db from '../db';
import { updateChannel } from '../store/channelActions';

export function useUpdateChannel() {
  return useCallback(
    async ({ group, channel }: { group: db.Group; channel: db.Channel }) => {
      const groupNavSections = group?.navSections ?? [];
      const navSection = groupNavSections.find((section) =>
        section.channels?.map((c) => c.channelId).includes(channel.id)
      );

      if (!navSection || !group) {
        return;
      }

      await updateChannel({
        groupId: group.id,
        channel,
        sectionId: navSection.sectionId,
        readers: channel.readerRoles?.map((r) => r.roleId) ?? [],
        writers: channel.writerRoles?.map((r) => r.roleId) ?? [],
        join: true,
      });
    },
    []
  );
}
