import React, { useState, useCallback } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { Status } from '@/logic/status';
import { useIsMobile } from '@/logic/useMedia';
import { nestToFlag, getFlagParts } from '@/logic/utils';
import { useRouteGroup, useDeleteChannelMutation } from '@/state/groups';
import { GroupChannel } from '@/types/groups';
import { useIsChannelHost } from '@/logic/channel';
import ActionMenu, { Action } from '@/components/ActionMenu';

interface ChannelActionsProps {
  nest: string;
  prettyAppName: string;
  channel: GroupChannel | undefined;
  isAdmin: boolean | undefined;
  leave: (flag: string) => Promise<void>;
}

const ChannelActions = React.memo(
  ({ nest, prettyAppName, channel, isAdmin, leave }: ChannelActionsProps) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [_app, flag] = nestToFlag(nest);
    const groupFlag = useRouteGroup();
    const { ship, name } = getFlagParts(groupFlag);
    const [isOpen, setIsOpen] = useState(false);
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

    const actions: Action[] = [];

    if (isAdmin) {
      actions.push(
        {
          key: 'edit',
          content: `Edit ${prettyAppName}`,
          onClick: () => setEditIsOpen(!editIsOpen),
        },
        {
          key: 'delete',
          content: `Delete ${prettyAppName}`,
          onClick: () => setDeleteChannelIsOpen(!deleteChannelIsOpen),
          type: 'destructive',
        }
      );
    }

    if (!isChannelHost) {
      actions.push({
        key: 'leave',
        content: `Leave ${prettyAppName}`,
        onClick: leaveChannel,
        type: 'destructive',
      });
    }

    return (
      <>
        <ActionMenu open={isOpen} onOpenChange={setIsOpen} actions={actions}>
          <button
            className="flex h-8 w-8 items-center justify-center rounded text-gray-800 hover:bg-gray-50 sm:h-6 sm:w-6 sm:text-gray-600"
            aria-label="Channel Options"
          >
            <EllipsisIcon className="h-8 w-8 p-1 sm:h-6 sm:w-6 sm:p-0" />
          </button>
        </ActionMenu>
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
);

export default ChannelActions;
