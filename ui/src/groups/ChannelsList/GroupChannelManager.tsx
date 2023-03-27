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
        <header className="flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4">
          <Link
            to={`/groups/${flag}`}
            className="default-focus inline-flex items-center text-base font-semibold text-gray-800 hover:bg-gray-50"
            aria-label="Back to Group"
          >
            <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            {/* <GroupAvatar {...group?.meta} size="h-6 w-6" className="mr-3" /> */}
            <h1 className="shrink text-lg font-bold text-gray-800 line-clamp-1">
              All Channels in {group?.meta.title}
            </h1>
          </Link>
        </header>
      )}
      <div className="flex grow flex-col bg-gray-50 px-2 sm:px-6">
        <ChannelSearchProvider>
          <ChannelsList />
        </ChannelSearchProvider>
      </div>
    </section>
  );
}
