import React from 'react';
import { useRouteGroup, useGroup, useAmAdmin } from '@/state/groups';
import { useNavigate } from 'react-router';
import { Channel } from '@/types/groups';
import { groupBy } from 'lodash';
import BubbleIcon from '@/components/icons/BubbleIcon';
import { pluralize } from '@/logic/utils';

const UNZONED = '';

function Channel({ channel }: { channel: Channel }) {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  // TODO: figure out Channel participant count
  const participantCount = Object.keys(group.fleet).length;

  return (
    <div className="my-2 flex flex-row items-center justify-between">
      {/* avatar, title, participants */}
      <div className="flex flex-row">
        <div className="mr-3 flex h-12 w-12 items-center justify-center rounded bg-gray-50">
          {/* TODO: Channel Type icons */}
          <BubbleIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex flex-col justify-evenly">
          <div className="font-semibold text-gray-800">
            {channel.meta.title}
          </div>
          <div className="font-semibold text-gray-400">
            {participantCount} {pluralize('member', participantCount)}
          </div>
        </div>
      </div>
      {/* action and options */}
      <div>
        {channel.join ? (
          <button>Joined</button>
        ) : (
          <button className="rounded-md bg-gray-50 py-2 px-4 font-semibold text-gray-800">
            Join
          </button>
        )}
      </div>
    </div>
  );
}

function ChannelSection({
  channels,
  zone,
}: {
  channels: Channel[];
  zone: string | null;
}) {
  const sortedChannels = channels.slice();
  sortedChannels.sort((a, b) => a.meta.title.localeCompare(b.meta.title));

  return (
    <div>
      {zone !== UNZONED ? (
        <div className="py-4 font-semibold text-gray-400">{zone}</div>
      ) : null}
      {sortedChannels.map((channel) => (
        <Channel channel={channel} />
      ))}
    </div>
  );
}

export default function ChannelIndex() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const navigate = useNavigate();
  const isAdmin = useAmAdmin(flag);

  if (!group) {
    return null;
  }

  const sectionedChannels = groupBy(
    Object.entries(group.channels).map((e) => e[1]),
    (ch) => ch.zone
  );
  // unsectioned channels have zone 'null' after groupBy; replace with empty str
  if ('null' in sectionedChannels) {
    sectionedChannels[UNZONED] = sectionedChannels.null;
    delete sectionedChannels.null;
  }

  const zones = Object.keys(sectionedChannels);
  // TODO: respect the sorted order set by the user?
  zones.sort((a, b) => {
    if (a === UNZONED || a < b) {
      return -1;
    }
    if (b === UNZONED || a > b) {
      return 1;
    }

    return 0;
  });

  return (
    <div className="w-full p-4">
      <div className="mb-4 flex flex-row justify-between">
        <h1 className="text-lg font-bold">All Channels</h1>
        {isAdmin ? (
          <button
            onClick={() => navigate(`/groups/${flag}/info/channel-settings`)}
            className="rounded-md bg-gray-800 py-1 px-2 text-[12px] font-semibold leading-4 text-white"
          >
            Channel Settings
          </button>
        ) : null}
      </div>
      <div className="w-full rounded-xl bg-white px-4 py-1">
        {zones.map((zone) => (
          <ChannelSection channels={sectionedChannels[zone]} zone={zone} />
        ))}
      </div>
    </div>
  );
}
