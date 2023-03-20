import React from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useRouteGroup, useGroup, useAmAdmin } from '../../state/groups/groups';
import GroupInfoEditor from './GroupInfoEditor';
import GroupMemberManager from './GroupMemberManager';
import GroupSummary from '../GroupSummary';

export default function GroupInfo({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const isAdmin = useAmAdmin(flag);
  if (isAdmin) {
    return <GroupInfoEditor title={title} />;
  }

  const meta = group?.meta;
  if (!meta) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>
          {group?.meta ? `Info for ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      <div className="card mb-4 flex flex-col">
        <GroupSummary flag={flag} preview={{ ...group, flag }} />
        <p className="mt-4 w-full leading-5">{meta.description}</p>
      </div>
      <GroupMemberManager />
    </>
  );
}
