import React from 'react';
import { useGroup, useRouteGroup } from '@/state/groups';
import LureInviteBlock from '../LureInviteBlock';
import { GroupInviteBlock } from '../GroupInviteDialog';
import { PrivacySelectorForm } from './PrivacySelector';

function GroupInvitesPrivacy() {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);

  if (group)
    return (
      <div className="flex flex-col space-y-4">
        <div className="card">
          <div className="mb-4">
            <h2 className="mb-2 text-lg font-bold">Default Privacy</h2>
            <p className="leading-5 text-gray-600">
              Set your group&rsquo;s default privacy mode. Affects your
              group&rsquo;s abaility to be discovered and linked to on the
              network.
            </p>
          </div>
          <PrivacySelectorForm />
        </div>
        <LureInviteBlock flag={groupFlag} group={group} className="grow" />
        <GroupInviteBlock />
      </div>
    );

  return null;
}

export default GroupInvitesPrivacy;
