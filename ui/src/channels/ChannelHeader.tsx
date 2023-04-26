import React, {
  PropsWithChildren,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { GroupChannel } from '@/types/groups';
import { useIsMobile } from '@/logic/useMedia';
import useIsChannelHost from '@/logic/useIsChannelHost';
import { nestToFlag, getFlagParts, isTalk } from '@/logic/utils';
import {
  useChannel,
  useAmAdmin,
  useRouteGroup,
  useDeleteChannelMutation,
} from '@/state/groups';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import ChannelIcon from '@/channels/ChannelIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import { Status } from '@/logic/status';
import { useNotifications } from '@/notifications/useNotifications';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import { useSawRopeMutation } from '@/state/hark';

export type ChannelHeaderProps = PropsWithChildren<{
  flag: string;
  nest: string;
  prettyAppName: string;
  leave: (flag: string) => Promise<void>;
}>;

interface ChannelActionsProps {
  nest: string;
  prettyAppName: string;
  channel: GroupChannel | undefined;
  isAdmin: boolean | undefined;
  leave: (flag: string) => Promise<void>;
}

function ChannelActions({
  nest,
  prettyAppName,
  channel,
  isAdmin,
  leave,
}: ChannelActionsProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [_app, flag] = nestToFlag(nest);
  const groupFlag = useRouteGroup();
  const { ship, name } = getFlagParts(groupFlag);
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  const [editIsOpen, setEditIsOpen] = useState(false);
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  const isChannelHost = useIsChannelHost(flag);
  const { mutate: deleteChannelMutate } = useDeleteChannelMutation();

  const leaveChannel = useCallback(async () => {
    try {
      leave(flag);
      navigate(
        isMobile
          ? `/groups/${ship}/${name}`
          : `/groups/${ship}/${name}/channels`
      );
    } catch (error) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[ChannelHeader:LeaveError] ${error}`);
      }
    }
  }, [flag, ship, name, navigate, leave, isMobile]);

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteStatus('loading');
    try {
      deleteChannelMutate({ flag: groupFlag, nest });
      navigate(
        isMobile
          ? `/groups/${ship}/${name}`
          : `/groups/${ship}/${name}/channels`
      );
      setDeleteStatus('success');
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (error) {
      setDeleteStatus('error');
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [
    deleteChannelIsOpen,
    groupFlag,
    nest,
    deleteChannelMutate,
    isMobile,
    name,
    navigate,
    ship,
  ]);

  return (
    <>
      <Dropdown.Root open={dropdownIsOpen} onOpenChange={setDropdownIsOpen}>
        <Dropdown.Trigger asChild>
          <button
            className="flex h-6 w-6 items-center justify-center rounded  text-gray-400 hover:bg-gray-50"
            aria-label="Channel Options"
          >
            <EllipsisIcon className="h-6 w-6" />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Content className="dropdown">
          {isAdmin && (
            <>
              <Dropdown.Item
                className="dropdown-item"
                onClick={() => setEditIsOpen(!editIsOpen)}
              >
                Edit {prettyAppName}
              </Dropdown.Item>
              <Dropdown.Item
                className="dropdown-item text-red"
                onClick={() => setDeleteChannelIsOpen(!deleteChannelIsOpen)}
              >
                Delete {prettyAppName}
              </Dropdown.Item>
            </>
          )}
          {!isChannelHost && (
            <Dropdown.Item
              className="dropdown-item text-red"
              onClick={leaveChannel}
            >
              Leave {prettyAppName}
            </Dropdown.Item>
          )}
        </Dropdown.Content>
      </Dropdown.Root>
      {channel && (
        <>
          <EditChannelModal
            editIsOpen={editIsOpen}
            setEditIsOpen={setEditIsOpen}
            nest={nest}
            channel={channel}
            setDeleteChannelIsOpen={setDeleteChannelIsOpen}
            app={_app}
          />
          <DeleteChannelModal
            deleteChannelIsOpen={deleteChannelIsOpen}
            onDeleteChannelConfirm={onDeleteChannelConfirm}
            setDeleteChannelIsOpen={setDeleteChannelIsOpen}
            channel={channel}
            deleteStatus={deleteStatus}
          />
        </>
      )}
    </>
  );
}

export default function ChannelHeader({
  flag,
  nest,
  prettyAppName,
  leave,
  children,
}: ChannelHeaderProps) {
  const isMobile = useIsMobile();
  const channel = useChannel(flag, nest);
  const BackButton = isMobile ? Link : 'div';
  const isAdmin = useAmAdmin(flag);
  const { notifications, count } = useNotifications(flag);
  const { mutate: sawRopeMutation } = useSawRopeMutation();
  useEffect(() => {
    if (count > 0) {
      const unreadBins = notifications
        .filter((n) => n.skeins.some((b) => b.unread === true))[0]
        ?.skeins.filter((b) => b.unread === true);

      if (unreadBins) {
        const unreadsHere = unreadBins.filter((b) => b.top.wer.includes(nest));

        unreadsHere.forEach((n, index) => {
          // update on the last call
          sawRopeMutation({
            rope: n.top.rope,
            update: index === unreadsHere.length - 1,
          });
        });
      }
    }
  }, [count, notifications, nest, sawRopeMutation]);

  function backTo() {
    if (isMobile && isTalk) {
      return '/';
    }
    return `/groups/${flag}`;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4'
      )}
    >
      <BackButton
        to={backTo()}
        className={cn(
          'default-focus ellipsis inline-flex appearance-none items-center pr-2 text-lg font-bold text-gray-800 sm:text-base sm:font-semibold',
          isMobile && ''
        )}
        aria-label="Open Channels Menu"
      >
        {isMobile ? (
          <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
        ) : null}
        <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
          <ChannelIcon nest={nest} className="h-5 w-5 text-gray-400" />
        </div>
        <span className="ellipsis line-clamp-1">{channel?.meta.title}</span>
      </BackButton>
      <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
        {isMobile && <ReconnectingSpinner />}
        {children}
        <ChannelActions {...{ nest, prettyAppName, channel, isAdmin, leave }} />
      </div>
    </div>
  );
}
