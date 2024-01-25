import { Helmet } from 'react-helmet';
import { ViewProps } from '@/types/groups';
import { useRouteGroup, useGroup } from '@/state/groups/groups';
import { useIsMobile } from '@/logic/useMedia';
import MobileHeader from '@/components/MobileHeader';
import ChannelsList from './ChannelsList';
import { ChannelSearchProvider } from './useChannelListSearch';
import GroupAvatar from '../GroupAvatar';
import GroupActions from '../GroupActions';
import GroupHostConnection from '../GroupHostConnection';

export default function GroupChannelManager({ title }: ViewProps) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  return (
    <section className="flex h-full w-full flex-col overflow-hidden">
      <Helmet>
        <title>
          {group ? `Channels in ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>

      {isMobile && (
        <MobileHeader
          title={
            <GroupActions flag={flag}>
              <button className="flex flex-col items-center">
                <GroupAvatar image={group?.meta.image} className="mt-3" />
                <div className="my-1 flex w-full items-center justify-center space-x-1">
                  <h1 className="text-[17px] text-gray-800">All Channels</h1>
                  <GroupHostConnection flag={flag} type="bullet" />
                </div>
              </button>
            </GroupActions>
          }
          pathBack={`/groups/${flag}`}
        />
      )}
      <div className="flex grow flex-col overflow-auto bg-gray-50 px-2 sm:px-6">
        <ChannelSearchProvider>
          <ChannelsList />
        </ChannelSearchProvider>
      </div>
    </section>
  );
}
