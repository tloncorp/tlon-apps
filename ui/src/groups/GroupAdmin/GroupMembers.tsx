import React from 'react';
import { Helmet } from 'react-helmet';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import { ViewProps } from '@/types/groups';
import GroupMemberManager from './GroupMemberManager';
import GroupPendingManager from './GroupPendingManager';

export default function GroupMembers({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <Helmet>
        <title>
          {group ? `Members of ${group.meta.title} ${title}` : title}{' '}
        </title>
      </Helmet>
      <GroupPendingManager />
      <div className="h-4" />
      <GroupMemberManager half />
    </div>
  );
}
