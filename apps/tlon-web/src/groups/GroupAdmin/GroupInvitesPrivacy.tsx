import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import React from 'react';
import { Helmet } from 'react-helmet';

import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/logic/useMedia';
import { useGroup, useRouteGroup } from '@/state/groups';

import { GroupInviteBlock } from '../GroupInviteDialog';
import LureInviteBlock from '../LureInviteBlock';
import { PrivacySelectorForm } from './PrivacySelector';

function GroupInvitesPrivacy({ title }: ViewProps) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const isMobile = useIsMobile();

  if (group)
    return (
      <>
        <Helmet>
          <title>
            {group ? `Privacy of ${group.meta.title} ${title}` : title}{' '}
          </title>
        </Helmet>
        {isMobile && (
          <MobileHeader
            title="Invites & Privacy"
            pathBack={`/groups/${groupFlag}/edit`}
          />
        )}
        <div className="h-full overflow-auto px-6 py-4 pb-16 md:px-4">
          <div className="mb-4">
            <h2 className="mb-2 text-lg font-semibold">
              Privacy & Discoverability
            </h2>
            <p className="leading-5 text-gray-600">
              Set your group&rsquo;s default privacy mode. Affects your
              group&rsquo;s abaility to be discovered and linked to on the
              network.
            </p>
          </div>
          <PrivacySelectorForm />
          <div className="my-4 border-t border-gray-50 pt-4">
            <LureInviteBlock flag={groupFlag} group={group} className="grow" />
          </div>
          <div className="my-4 border-t border-gray-50">
            <GroupInviteBlock />
          </div>
        </div>
      </>
    );

  return null;
}

export default GroupInvitesPrivacy;
