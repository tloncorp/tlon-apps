import React from 'react';
import { useRouteGroup, useGroup, useAmAdmin } from '../../state/groups';
import GroupAvatar from '../GroupAvatar';
import GroupInfoEditor from './GroupInfoEditor';
import GroupMemberManager from './GroupMemberManager';

export default function GroupInfo() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const isAdmin = useAmAdmin(flag);
  if (isAdmin) {
    return <GroupInfoEditor />;
  }

  const meta = group?.meta;
  if (!meta) {
    return null;
  }

  return (
    <>
      <div className="card mb-4 flex flex-col items-center">
        <GroupAvatar {...meta} size="h-20 w-20" />
        <div className="my-4 text-center">
          <h2 className="center mb-2 font-semibold">{meta.title}</h2>
          {/* Current group meta object doesn't contain public/private info  */}
          <h3 className="text-base text-gray-600">Private Group</h3>
        </div>
        <p className="w-full leading-5">{meta.description}</p>
      </div>
      <GroupMemberManager />
    </>
  );
}
