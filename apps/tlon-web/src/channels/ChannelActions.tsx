import { GroupChannel } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import ActionMenu, { Action } from '@/components/ActionMenu';
import useActiveTab, { useNavWithinTab } from '@/components/Sidebar/util';
import VolumeSetting from '@/components/VolumeSetting';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { useIsChannelHost } from '@/logic/channel';
import { Status } from '@/logic/status';
import { useIsMobile } from '@/logic/useMedia';
import { getFlagParts, nestToFlag } from '@/logic/utils';
import { useDeleteChannelMutation, useRouteGroup } from '@/state/groups';

import ChannelHostConnection from './ChannelHostConnection';

export type ChannelActionsProps = PropsWithChildren<{
  nest: string;
  prettyAppName: string;
  channel: GroupChannel | undefined;
  isAdmin: boolean | undefined;
  leave: ({ nest }: { nest: string }) => Promise<void>;
  className?: string;
}>;

const ChannelActions = React.memo(
  ({
    nest,
    prettyAppName,
    channel,
    isAdmin,
    leave,
    className,
    children,
  }: ChannelActionsProps) => {
    const { navigate } = useNavWithinTab();
    const isMobile = useIsMobile();
    const [_app, flag] = nestToFlag(nest);
    const groupFlag = useRouteGroup();
    const { ship, name } = getFlagParts(groupFlag);
    const [isOpen, setIsOpen] = useState(false);
    const [editIsOpen, setEditIsOpen] = useState(false);
    const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
    const [showNotifications, setShowNotifications] = useState(false);
    const isChannelHost = useIsChannelHost(flag);
    const { mutate: deleteChannelMutate } = useDeleteChannelMutation();
    const hasChildren = !!children;
    const activeTab = useActiveTab();

    const leaveChannel = useCallback(async () => {
      try {
        leave({ nest });
        navigate(
          isMobile
            ? `/groups/${ship}/${name}`
            : activeTab === 'messages'
              ? `/messages`
              : `/groups/${ship}/${name}/channels`
        );
      } catch (error) {
        if (error) {
          // eslint-disable-next-line no-console
          console.error(`[ChannelHeader:LeaveError] ${error}`);
        }
      }
    }, [nest, ship, name, navigate, leave, isMobile, activeTab]);

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
    const notificationActions: Action[] = [];

    notificationActions.push({
      key: 'volume',
      content: (
        <div className="-mx-2 flex flex-col space-y-6">
          <div className="flex flex-col space-y-1">
            <span className="text-lg text-gray-800">Notification Settings</span>
            <span className="text-[17px] font-normal text-gray-400">
              {channel?.meta.title || `~${nest}`}
            </span>
          </div>
          <VolumeSetting source={{ channel: { nest, group: groupFlag } }} />
        </div>
      ),
      keepOpenOnClick: true,
    });

    if (isMobile) {
      actions.push({
        key: 'connectivity',
        keepOpenOnClick: true,
        content: (
          <ChannelHostConnection
            nest={nest}
            type="combo"
            className="-ml-1 text-[17px] font-medium text-gray-800"
          />
        ),
      });
    }

    actions.push({
      key: 'notifications',
      onClick: () => {
        if (isMobile) {
          setShowNotifications(true);
        } else {
          navigate(`/groups/${groupFlag}/channels/${nest}/volume`, true);
        }
      },
      content: 'Notifications',
    });

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
        <ActionMenu
          className="max-w-full"
          open={isOpen}
          onOpenChange={setIsOpen}
          actions={actions}
        >
          <button
            className={cn(
              !hasChildren &&
                'default-focus flex h-8 w-8 items-center justify-center rounded text-gray-900 hover:bg-gray-50 sm:h-6 sm:w-6 sm:text-gray-600',
              className
            )}
            aria-label="Channel Options"
          >
            {hasChildren ? (
              children
            ) : (
              <EllipsisIcon className="h-8 w-8 p-1 sm:h-6 sm:w-6 sm:p-0" />
            )}
          </button>
        </ActionMenu>
        <ActionMenu
          open={showNotifications}
          onOpenChange={setShowNotifications}
          actions={notificationActions}
        />
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
