/* eslint-disable no-console */
import { groupBy } from 'lodash';
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import { useRouteGroup, useGroup, useAmAdmin } from '@/state/groups';
import { Channel } from '@/types/groups';
import BubbleIcon from '@/components/icons/BubbleIcon';
import { channelHref, pluralize } from '@/logic/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import LeaveIcon from '@/components/icons/LeaveIcon';
import BulletIcon from '@/components/icons/BulletIcon';
import { useBriefs, useChatState } from '@/state/chat';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import PencilIcon from '@/components/icons/PencilIcon';

const UNZONED = '';
const READY = 'READY';
const PENDING = 'PENDING';
const FAILED = 'FAILED';
type JoinState = typeof READY | typeof PENDING | typeof FAILED;

function Channel({ channel, flag }: { flag: string; channel: Channel }) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const briefs = useBriefs();
  const isAdmin = useAmAdmin(flag);
  const navigate = useNavigate();

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [joinState, setJoinState] = useState<JoinState>(READY);

  const editChannel = useCallback(() => {
    navigate(`/groups/${flag}/info/channels`);
  }, [flag, navigate]);

  const joinChannel = useCallback(async () => {
    try {
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      setJoinState(PENDING);
      await useChatState.getState().joinChat(flag);
      setJoinState(READY);
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:JoinError] ${error}`);
      }
      setJoinState(FAILED);
      setTimer(
        setTimeout(() => {
          setJoinState(READY);
          setTimer(null);
        }, 10 * 1000)
      );
    }
  }, [flag, timer]);

  const leaveChannel = useCallback(async () => {
    try {
      await useChatState.getState().leaveChat(flag);
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:LeaveError] ${error}`);
      }
    }
  }, [flag]);

  const muteChannel = useCallback(() => {
    // TODO: what happens on Mute?
    console.log('mute ...');
  }, []);

  if (!group) {
    return null;
  }

  const channelFlag = Object.entries(group.channels).find(
    (entry) => entry[1] === channel
  )?.[0];

  // If the current user is the Channel host, they are automatically joined,
  // and cannot leave the group
  const isChannelHost = window.our === channelFlag?.split('/')[0];

  // A Channel is considered Joined if hosted by current user, or if a Brief
  // exists
  const joined = isChannelHost || (channelFlag && channelFlag in briefs);

  return (
    <div className="my-2 flex flex-row items-center justify-between">
      {/* avatar, title, participants */}
      <div className="flex flex-row">
        <div className="mr-3 flex h-12 w-12 items-center justify-center rounded bg-gray-50">
          {/* TODO: Channel Type icons */}
          <BubbleIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex flex-col justify-evenly">
          {joined && channelFlag ? (
            <Link
              className="font-semibold text-gray-800"
              to={channelHref(groupFlag, channelFlag)}
            >
              {channel.meta.title}
            </Link>
          ) : (
            <div className="font-semibold text-gray-800">
              {channel.meta.title}
            </div>
          )}
        </div>
      </div>
      {/* action and options */}
      <div>
        {joined ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild className="appearance-none">
              <button className="button bg-green-soft text-green">
                <span className="mr-1">Joined</span>{' '}
                <CaretDown16Icon className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="dropdown">
              <DropdownMenu.Item
                onSelect={muteChannel}
                className="dropdown-item flex items-center space-x-2"
              >
                <BulletIcon className="h-6 w-6 text-gray-400" />
                <span className="text-gray-800">Mute Channel</span>
              </DropdownMenu.Item>
              {isAdmin ? (
                <DropdownMenu.Item
                  onSelect={editChannel}
                  className="dropdown-item flex items-center space-x-2"
                >
                  <PencilIcon className="m-1.5 h-3 w-3 fill-gray-500" />
                  <span>Edit Channel</span>
                </DropdownMenu.Item>
              ) : null}
              {!isChannelHost ? (
                <DropdownMenu.Item
                  onSelect={leaveChannel}
                  className="dropdown-item flex items-center space-x-2 text-red hover:bg-red-soft hover:dark:bg-red-900"
                >
                  <LeaveIcon className="h-6 w-6" />
                  <span>Leave Channel</span>
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : (
          <button
            disabled={joinState === PENDING}
            onClick={joinChannel}
            className={cn('button disabled:bg-gray-50', {
              'bg-gray-50': [READY, PENDING].includes(joinState),
              'bg-red-soft': joinState === FAILED,
              'text-gray-800': joinState === READY,
              'text-gray-400': joinState === PENDING,
              'text-red': joinState === FAILED,
            })}
          >
            {joinState === PENDING ? (
              <span className="center-items flex">
                <LoadingSpinner />
                <span className="ml-2">Joining...</span>
              </span>
            ) : joinState === FAILED ? (
              'Retry'
            ) : (
              'Join'
            )}
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
  channels: [string, Channel][];
  zone: string | null;
}) {
  const sortedChannels = channels.slice();
  sortedChannels.sort(([, a], [, b]) =>
    a.meta.title.localeCompare(b.meta.title)
  );

  return (
    <div>
      {zone !== UNZONED ? (
        <div className="py-4 font-semibold text-gray-400">{zone}</div>
      ) : null}
      {sortedChannels.map(([flag, channel]) => (
        <Channel flag={flag} channel={channel} key={channel.added} />
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
    Object.entries(group.channels),
    ([, ch]) => ch.zone
  );
  // unsectioned channels have zone 'null' after groupBy; replace with empty str
  if ('null' in sectionedChannels) {
    sectionedChannels[UNZONED] = sectionedChannels.null;
    delete sectionedChannels.null;
  }

  const zones = Object.keys(sectionedChannels);
  // TODO: respect the sorted order set by the user?
  zones.sort((a, b) => {
    if (a === UNZONED) {
      return -1;
    }
    if (b === UNZONED) {
      return 1;
    }

    return a.localeCompare(b);
  });

  return (
    <section className="w-full p-4">
      <div className="mb-4 flex flex-row justify-between">
        <h1 className="text-lg font-bold">All Channels</h1>
        {isAdmin ? (
          <button
            onClick={() => navigate(`/groups/${flag}/info/channels`)}
            className="rounded-md bg-gray-800 py-1 px-2 text-[12px] font-semibold leading-4 text-white"
          >
            Channel Settings
          </button>
        ) : null}
      </div>
      {zones.map((zone) => (
        <div key={zone} className="mb-2 w-full rounded-xl bg-white px-4 py-1">
          <ChannelSection channels={sectionedChannels[zone]} zone={zone} />
        </div>
      ))}
    </section>
  );
}
