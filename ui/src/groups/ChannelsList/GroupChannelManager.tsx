import React from 'react';
import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup } from '@/state/groups/groups';
import { Link } from 'react-router-dom';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import { useIsMobile } from '@/logic/useMedia';
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
        <div className="flex flex-row items-center justify-between py-1 px-2 sm:p-4">
          <Link
            to={`/groups/${flag}`}
            className="flex cursor-pointer select-none items-center rounded-lg p-2 hover:bg-gray-50 sm:cursor-text sm:select-text"
            aria-label="Back to Group"
          >
            <CaretLeft16Icon className="mr-1 h-4 w-4 text-gray-400" />
            <h1 className="text-base font-semibold sm:text-lg">All Channels</h1>
          </Link>
        </div>
      )}
      <div className="m-4 flex grow flex-col sm:my-5 sm:mx-8">
        <ChannelSearchProvider>
          <ChannelsList />
        </ChannelSearchProvider>
      </div>
    </section>
  );
}
