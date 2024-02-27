import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import React from 'react';
import { Helmet } from 'react-helmet';

import MobileHeader from '../MobileHeader';
import BlockedUsers from './BlockedUsers';

export default function BlockedUsersView({ title }: ViewProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <MobileHeader title="Blocked Users" pathBack="/profile/settings" />
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <BlockedUsers />
    </div>
  );
}
