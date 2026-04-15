import * as api from '@tloncorp/api';

import * as db from '../../db';

export async function syncGroupPreviews(groupIds: string[]) {
  const promises = groupIds.map(async (groupId) => {
    const group = await db.getGroup({ id: groupId });
    if (group?.currentUserIsMember) {
      return group;
    }

    const groupPreview = await api.getGroupPreview(groupId);
    await db.insertUnjoinedGroups([groupPreview]);
    return groupPreview;
  });

  return Promise.all(promises);
}
