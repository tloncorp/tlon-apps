import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import { ViewProps } from '@/types/groups';
import React from 'react';
import { Helmet } from 'react-helmet';

import GroupMemberManager from './GroupMemberManager';
import GroupPendingManager from './GroupPendingManager';

export default function GroupMembers({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

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
      {isMobile && (
        <MobileHeader title="Members" pathBack={`/groups/${flag}/edit`} />
      )}
      <div className="h-full px-6 md:px-4">
        <GroupPendingManager />
        <div className="h-4" />
        <GroupMemberManager half />
      </div>
    </div>
  );
}
