import React from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup } from '@/state/groups/groups';
import { useIsMobile } from '@/logic/useMedia';
import MobileHeader from '@/components/MobileHeader';
import ChannelsList from './ChannelsList';
import { ChannelSearchProvider } from './useChannelSearch';

export default function GroupChannelManager({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  return (
    <section className="flex w-full grow flex-col overflow-y-scroll">
      <Helmet>
        <title>
          {group ? `Channels in ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      {isMobile && (
        <MobileHeader title="All Channels" pathBack={`/groups/${flag}`} />
      )}
      <div className="flex grow flex-col bg-gray-50 px-2 sm:px-6">
        <ChannelSearchProvider>
          <ChannelsList />
        </ChannelSearchProvider>
      </div>
    </section>
  );
}
