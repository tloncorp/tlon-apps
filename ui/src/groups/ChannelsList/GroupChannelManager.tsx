import React from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup } from '@/state/groups/groups';
import ChannelsList from './ChannelsList';
import { ChannelSearchProvider } from './useChannelSearch';

export default function GroupChannelManager({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  return (
    <>
      <Helmet>
        <title>
          {group ? `Channels in ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      <section className="flex w-full grow flex-col overflow-y-scroll">
        <div className="m-4 flex grow flex-col sm:my-5 sm:mx-8">
          <ChannelSearchProvider>
            <ChannelsList />
          </ChannelSearchProvider>
        </div>
      </section>
    </>
  );
}
