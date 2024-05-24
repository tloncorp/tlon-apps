import cn from 'classnames';
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import ActionMenu, { Action } from '@/components/ActionMenu';
import UnreadIndicator from '@/components/Sidebar/UnreadIndicator';
import { useNavWithinTab } from '@/components/Sidebar/util';
import VolumeSetting from '@/components/VolumeSetting';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import useGroupUnread from '@/logic/useIsGroupUnread';
import { useIsMobile } from '@/logic/useMedia';
import {
  citeToPath,
  getPrivacyFromGroup,
  preSig,
  useCopy,
} from '@/logic/utils';
import {
  useAmAdmin,
  useGang,
  useGroup,
  useGroupCancelMutation,
  usePinnedGroups,
} from '@/state/groups';
import { useAddPinMutation, useDeletePinMutation } from '@/state/pins';

import GroupHostConnection from './GroupHostConnection';

const { ship } = window;

export function useGroupActions({
  flag,
  open = false,
  onOpenChange,
}: {
  flag: string;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const { mutateAsync: addPin } = useAddPinMutation();
  const { mutateAsync: deletePin } = useDeletePinMutation();
  const [isOpen, setIsOpen] = useState(false);
  const handleOpenChange = useCallback(
    (innerOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(innerOpen);
      } else {
        setIsOpen(innerOpen);
      }
    },
    [onOpenChange]
  );

  useEffect(() => {
    setIsOpen(open);
  }, [open, setIsOpen]);

  const { doCopy } = useCopy(citeToPath({ group: flag }));
  const [copyItemText, setCopyItemText] = useState('Copy group reference');
  const pinned = usePinnedGroups();
  const isPinned = Object.keys(pinned).includes(flag);

  const onCopy = useCallback(() => {
    doCopy();
    setCopyItemText('Copied!');
    setTimeout(() => {
      setCopyItemText('Copy group reference');
      handleOpenChange(false);
    }, 2000);
  }, [doCopy, handleOpenChange]);

  const onPinClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPinned) {
        deletePin({ pin: flag });
      } else {
        addPin({ pin: flag });
      }
    },
    [flag, isPinned, addPin, deletePin]
  );

  return {
    isOpen,
    isPinned,
    setIsOpen: handleOpenChange,
    copyItemText,
    onCopy,
    onPinClick,
  };
}

type GroupActionsProps = PropsWithChildren<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  flag: string;
  triggerDisabled?: boolean;
  className?: string;
}>;

const GroupActions = React.memo(
  ({
    open,
    onOpenChange,
    flag,
    triggerDisabled,
    className,
    children,
  }: GroupActionsProps) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const { getGroupUnread } = useGroupUnread();
    const { claim } = useGang(flag);
    const location = useLocation();
    const { navigate } = useNavWithinTab();
    const [host, name] = flag.split('/');
    const activity = getGroupUnread(flag);
    const group = useGroup(flag);
    const privacy = group ? getPrivacyFromGroup(group) : undefined;
    const isAdmin = useAmAdmin(flag);
    const isMobile = useIsMobile();
    const { mutate: cancelJoinMutation } = useGroupCancelMutation();
    const { isOpen, setIsOpen, isPinned, copyItemText, onCopy, onPinClick } =
      useGroupActions({ flag, open, onOpenChange });

    const onCopySelect = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        onCopy();
      },
      [onCopy]
    );

    const actions: Action[] = [];
    const notificationActions: Action[] = [];

    if (isMobile) {
      actions.push({
        key: 'header',
        keepOpenOnClick: true,
        containerClassName: '!px-2 !py-0 mt-4 mb-6',
        content: (
          <div className="leading-6">
            <div className="text-gray-800">
              {group?.meta.title || `~${flag}`}
            </div>
            <div className="font-normal text-gray-400">Quick actions</div>
          </div>
        ),
      });
    }

    if (isMobile) {
      actions.push({
        key: 'connection',
        keepOpenOnClick: true,
        containerClassName: '!p-0 mb-4',
        content: <GroupHostConnection flag={flag} type="row" />,
      });
    }

    if (privacy === 'public' || isAdmin) {
      actions.push({
        key: 'invite',
        type: 'prominent',
        containerClassName:
          'border border-blue-soft mb-4 md:mb-0 md:border-none',
        content: (
          <Link
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
          >
            Invite people
          </Link>
        ),
      });
    }

    if (isAdmin) {
      actions.push({
        key: 'settings',
        onClick: () => setIsOpen(false),
        containerClassName:
          'border border-gray-100 md:border-none mb-4 md:mb-0',
        content: (
          <Link to={`/groups/${flag}/edit`}>
            Group settings
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                Configure group details and privacy
              </div>
            )}
          </Link>
        ),
      });
    }

    actions.push(
      {
        key: 'pin',
        onClick: onPinClick,
        containerClassName:
          'border border-gray-100 md:border-none rounded-b-none',
        content: (
          <div>
            {isPinned ? 'Unpin' : 'Pin'}
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                {isPinned ? 'Unpin this group from' : 'Pin this group to'} the
                top of your Groups list
              </div>
            )}
          </div>
        ),
      },

      {
        key: 'copy',
        onClick: onCopySelect,
        keepOpenOnClick: true,
        containerClassName:
          'border border-gray-100 border-t-0 md:border-none rounded-t-none rounded-b-none',
        content: (
          <div>
            {copyItemText}
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                Copy an in-Urbit link to this group
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'members',
        onClick: () => setIsOpen(false),
        containerClassName:
          'border border-gray-100 border-t-0 md:border-none rounded-t-none rounded-b-none',
        content: (
          <Link to={`/groups/${flag}/members`}>
            Group members{' '}
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                View all members and roles
              </div>
            )}
          </Link>
        ),
      },
      {
        key: 'channels',
        onClick: () => setIsOpen(false),
        containerClassName:
          'border border-gray-100 border-t-0 md:border-none rounded-t-none rounded-b-none',
        content: (
          <Link to={`/groups/${flag}/channels`}>
            Channels{' '}
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                View all channels and sections you have visibility towards
              </div>
            )}
          </Link>
        ),
      },
      {
        key: 'notifications',
        onClick: () => {
          if (isMobile) {
            setShowNotifications(true);
          } else {
            navigate(`/groups/${flag}/volume`, true);
          }
        },
        containerClassName:
          'border border-gray-100 border-t-0 md:border-none rounded-t-none',
        content: (
          <div>
            Group notification settings
            {isMobile && (
              <div className="pt-1.5 text-[14px] font-normal text-gray-400">
                Configure your notifications for this group
              </div>
            )}
          </div>
        ),
      }
    );

    notificationActions.push({
      key: 'volume',
      content: (
        <div className="-mx-2 flex flex-col space-y-6">
          <div className="flex flex-col space-y-1">
            <span className="text-lg text-gray-800">Notification Settings</span>
            <span className="font-normal text-gray-400">
              {group?.meta.title || `~${flag}`}
            </span>
          </div>
          <VolumeSetting source={{ group: flag }} />
        </div>
      ),
      keepOpenOnClick: true,
    });

    if (preSig(ship) !== host) {
      actions.push({
        key: 'leave',
        type: 'destructive',
        containerClassName: 'border border-red-soft md:border-none mt-4',
        content: (
          <Link
            to={`/groups/${flag}/leave`}
            state={{ backgroundLocation: location }}
          >
            Leave group
          </Link>
        ),
      });
    }

    if (claim) {
      actions.push({
        key: 'cancel_join',
        type: 'destructive',
        containerClassName: 'border border-red-soft md:border-none mt-4',
        onClick: () => {
          cancelJoinMutation({ flag });
          setIsOpen(false);
        },
        content: 'Cancel join',
      });
    }

    return (
      <>
        <ActionMenu
          open={isOpen}
          onOpenChange={setIsOpen}
          actions={actions}
          disabled={triggerDisabled}
          asChild={!triggerDisabled}
          className={className}
        >
          {children || (
            <div className="relative h-6 w-6">
              {(isMobile || !isOpen) && activity.unread ? (
                <UnreadIndicator
                  notify={activity.notify}
                  className="absolute h-6 w-6 text-blue transition-opacity group-focus-within:opacity-0 sm:group-hover:opacity-0"
                  aria-label="Has Activity"
                />
              ) : null}
              {!isMobile && (
                <button
                  className={cn(
                    'default-focus absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-0.5 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100 sm:hover:opacity-100 sm:group-hover:opacity-100',
                    activity.unread
                      ? activity.notify
                        ? 'text-blue'
                        : 'text-gray-400'
                      : '',
                    isOpen ? 'opacity:100' : 'opacity-0'
                  )}
                  aria-label="Open Group Options"
                >
                  <EllipsisIcon className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
        </ActionMenu>
        <ActionMenu
          open={showNotifications}
          onOpenChange={setShowNotifications}
          actions={notificationActions}
        />
      </>
    );
  }
);

export default GroupActions;
