import React from 'react';
import { capitalize } from 'lodash';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useRouteGroup, useGroup, useAmAdmin } from '../../state/groups/groups';
import GroupAvatar from '../GroupAvatar';
import GroupInfoEditor from './GroupInfoEditor';
import GroupMemberManager from './GroupMemberManager';

export default function GroupInfo({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);

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
      <div className="card mb-4 flex flex-col items-center">
        <GroupAvatar {...meta} size="h-20 w-20" />
        <div className="my-4 text-center">
          <h2 className="center mb-2 font-semibold">{meta.title}</h2>
          <h3 className="text-base text-gray-600">
            {capitalize(privacy)} Group
          </h3>
        </div>
        <p className="w-full leading-5">{meta.description}</p>
      </div>
      <GroupMemberManager />
    </>
  );
}
