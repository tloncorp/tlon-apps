/* eslint-disable no-console */
import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useRouteGroup, useGroup, useAmAdmin, useVessel } from '@/state/groups';
import { GroupChannel, Zone, ViewProps } from '@/types/groups';
import {
  canReadChannel,
  channelHref,
  getFlagParts,
  isChannelImported,
  isChannelJoined,
  nestToFlag,
} from '@/logic/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import LeaveIcon from '@/components/icons/LeaveIcon';
import BulletIcon from '@/components/icons/BulletIcon';
import { useChatState } from '@/state/chat';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import PencilIcon from '@/components/icons/PencilIcon';
import useRequestState from '@/logic/useRequestState';
import ChannelIcon from '@/channels/ChannelIcon';
import useChannelSections from '@/logic/useChannelSections';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import useIsChannelHost from '@/logic/useIsChannelHost';
import useAllBriefs from '@/logic/useAllBriefs';
import { useIsMobile } from '@/logic/useMedia';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import MigrationTooltip from '@/components/MigrationTooltip';
import { useStartedMigration } from '@/logic/useMigrationInfo';
import useFilteredSections from '@/logic/useFilteredSections';
import EditChannelModal from '../GroupAdmin/AdminChannels/EditChannelModal';

const UNZONED = 'default';

function GroupChannelRow({
  channel,
  nest,
  migration,
}: {
  nest: string;
  channel: GroupChannel;
  migration: ReturnType<typeof useStartedMigration>;
}) {
  const [_app, flag] = nestToFlag(nest);
  const { ship } = getFlagParts(flag);
  const groupFlag = useRouteGroup();
  const isMobile = useIsMobile();
  const group = useGroup(groupFlag);
  const vessel = useVessel(groupFlag, window.our);
  const briefs = useAllBriefs();
  const { hasStarted, pendingImports } = migration;
  const imported = isChannelImported(nest, pendingImports) && hasStarted(ship);
  const joined = isChannelJoined(nest, briefs);
  const isChannelHost = useIsChannelHost(flag);
  const isAdmin = useAmAdmin(groupFlag);
  const navigate = useNavigate();
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  const { isFailed, isPending, isReady, setFailed, setPending, setReady } =
    useRequestState();
  const join = useCallback(
    (chFlag: string) => {
      const joiner =
        _app === 'chat'
          ? useChatState.getState().joinChat
          : _app === 'heap'
          ? useHeapState.getState().joinHeap
          : useDiaryState.getState().joinDiary;

      joiner(chFlag);
    },
    [_app]
  );
  const leave = useCallback(
    (chFlag: string) => {
      const leaver =
        _app === 'chat'
          ? useChatState.getState().leaveChat
          : _app === 'heap'
          ? useHeapState.getState().leaveHeap
          : useDiaryState.getState().leaveDiary;

      leaver(chFlag);
    },
    [_app]
  );

  const joinChannel = useCallback(async () => {
    try {
      if (timer) {
        clearTimeout(timer);
        setTimer(null);
      }
      setPending();
      await join(flag);
      setReady();
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:JoinError] ${error}`);
      }
      setFailed();
      setTimer(
        setTimeout(() => {
          setReady();
          setTimer(null);
        }, 10 * 1000)
      );
    }
  }, [flag, join, setFailed, setPending, setReady, timer]);

  const leaveChannel = useCallback(async () => {
    try {
      leave(flag);
    } catch (error) {
      if (error) {
        console.error(`[ChannelIndex:LeaveError] ${error}`);
      }
    }
  }, [flag, leave]);

  const muteChannel = useCallback(() => {
    // TODO: add channel mute action here
    console.log('mute ...');
  }, []);

  const open = useCallback(() => {
    if (!joined) {
      return;
    }
    navigate(channelHref(groupFlag, nest));
  }, [groupFlag, joined, navigate, nest]);

  const canRead = canReadChannel(channel, vessel, group?.bloc);

  if (!group || !canRead) {
    return null;
  }

  return (
    <li className="my-2 flex flex-row items-center justify-between rounded-lg pl-0 pr-2 hover:bg-gray-50">
      <button
        className={cn(
          'flex w-full items-center justify-start rounded-xl text-left hover:bg-gray-50',
          !isMobile ? 'p-2' : ''
        )}
        onClick={open}
        disabled={!joined || !imported}
      >
        <div className="flex flex-row">
          <div className="mr-3 flex h-12 w-12 items-center justify-center rounded bg-gray-50">
            <ChannelIcon nest={nest} className="h-6 w-6 text-gray-400" />
          </div>
          <div className="flex flex-col justify-evenly">
            {joined && imported && nest ? (
              <Link
                className="font-semibold text-gray-800"
                to={channelHref(groupFlag, nest)}
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
      </button>
      <div className="flex-none">
        {!imported ? (
          <MigrationTooltip ship={ship} side="left">
            <button className="secondary-button" disabled>
              Pending Migration
            </button>
          </MigrationTooltip>
        ) : joined ? (
          <>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild className="appearance-none">
                <button
                  className={cn(
                    'button bg-green-soft text-green mix-blend-multiply dark:bg-green-900 dark:mix-blend-screen hover:dark:bg-green-800',
                    isMobile && 'text-sm'
                  )}
                >
                  <span className="mr-1">Joined</span>{' '}
                  <CaretDown16Icon className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="dropdown">
                {/* TODO: un-disable this once channel mutes are complete */}
                <DropdownMenu.Item
                  onSelect={muteChannel}
                  className="dropdown-item disabled flex items-center space-x-2 hover:bg-transparent"
                >
                  <BulletIcon className="h-6 w-6 text-gray-400" />
                  <span className="text-gray-400">Mute Channel</span>
                </DropdownMenu.Item>
                {/* TODO: un-disable this once mentions and mutes are complete */}
                <DropdownMenu.Item
                  onSelect={muteChannel}
                  className="dropdown-item disabled flex items-center space-x-2 hover:bg-transparent"
                >
                  <BulletIcon className="h-6 w-6 text-gray-400" />
                  <span className="text-gray-400">Mute Mentions</span>
                </DropdownMenu.Item>
                {isAdmin ? (
                  <DropdownMenu.Item
                    onSelect={() => setEditIsOpen(!editIsOpen)}
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
            <EditChannelModal
              editIsOpen={editIsOpen}
              setEditIsOpen={setEditIsOpen}
              nest={nest}
              channel={channel}
            />
          </>
        ) : (
          <button
            disabled={isPending}
            onClick={joinChannel}
            className={cn(
              'button mix-blend-multiply disabled:bg-gray-50 dark:mix-blend-screen',
              {
                'bg-gray-50': isReady || isPending,
                'bg-red-soft': isFailed,
                'text-gray-800': isReady,
                'text-gray-400': isPending,
                'text-red': isFailed,
              },
              isMobile ? 'text-sm' : ''
            )}
          >
            {isPending ? (
              <span className="center-items flex">
                <LoadingSpinner />
                <span className="ml-2">Joining...</span>
              </span>
            ) : isFailed ? (
              'Retry'
            ) : (
              'Join'
            )}
          </button>
        )}
      </div>
    </li>
  );
}

function ChannelSection({
  channels,
  zone,
  migration,
}: {
  channels: [string, GroupChannel][];
  zone: Zone | null;
  migration: ReturnType<typeof useStartedMigration>;
}) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const sectionTitle =
    zone && group?.zones && zone in group.zones
      ? group.zones[zone].meta.title
      : '';

  return (
    <>
      {zone !== UNZONED ? (
        <div className="py-4 font-semibold text-gray-400">{sectionTitle}</div>
      ) : null}
      <ul>
        {channels.map(([nest, channel]) => (
          <GroupChannelRow
            nest={nest}
            channel={channel}
            key={channel.added}
            migration={migration}
          />
        ))}
      </ul>
    </>
  );
}

export default function ChannelIndex({ title }: ViewProps) {
  const flag = useRouteGroup();
  const { sectionedChannels } = useChannelSections(flag);
  const filteredSections = useFilteredSections(flag);
  const migration = useStartedMigration(flag);
  const navigate = useNavigate();
  const isAdmin = useAmAdmin(flag);
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const BackButton = isMobile ? Link : 'div';

  return (
    <section className="w-full sm:overflow-y-scroll">
      <Helmet>
        <title>
          {group ? `All Channels in ${group?.meta?.title} ${title}` : title}
        </title>
      </Helmet>
      <div className="flex flex-row items-center justify-between py-1 px-2 sm:p-4">
        <BackButton
          to={`/groups/${flag}`}
          className={cn(
            'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
            isMobile && 'flex items-center rounded-lg hover:bg-gray-50'
          )}
          aria-label="Back to Group"
        >
          {isMobile ? (
            <CaretLeft16Icon className="mr-1 h-4 w-4 text-gray-400" />
          ) : null}
          <h1 className="text-base font-semibold sm:text-lg">All Channels</h1>
        </BackButton>
        {isAdmin ? (
          <button
            onClick={() => navigate(`/groups/${flag}/info/channels`)}
            className="rounded-md bg-gray-800 py-1 px-2 text-[12px] font-semibold leading-4 text-white"
          >
            Channel Settings
          </button>
        ) : null}
      </div>
      <div className="p-4">
        {filteredSections.map((section) =>
          sectionedChannels[section] ? (
            <div
              key={section}
              className={cn(
                'mb-2 w-full rounded-xl bg-white py-1',
                !isMobile ? 'pl-4 pr-2' : ''
              )}
            >
              <ChannelSection
                channels={
                  section in sectionedChannels ? sectionedChannels[section] : []
                }
                zone={section}
                migration={migration}
              />
            </div>
          ) : null
        )}
      </div>
    </section>
  );
}
