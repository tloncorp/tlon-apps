import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import {
  groupIsInitializing,
  useGang,
  useGangPreview,
  useGroup,
  useGroupCancelMutation,
  useGroupLeaveMutation,
  useGroupRescindMutation,
} from '@/state/groups';
import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import X16Icon from '../icons/X16Icon';
import SidebarItem from './SidebarItem';

// Gang is a pending group invite
export default function GangItem(props: {
  flag: string;
  isJoining?: boolean;
  invited?: boolean;
}) {
  const { flag, isJoining = false, invited = false } = props;
  const location = useLocation();
  const gang = useGang(flag);
  const group = useGroup(flag);
  const gangPreview = useGangPreview(flag);
  const isMobile = useIsMobile();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { action, handlers } = useLongPress();
  const preview = gang?.preview || gangPreview;

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (action === 'longpress') {
      setOptionsOpen(true);
    }
  }, [action, isMobile]);

  const { mutate: rescindMutation, status: rescindStatus } =
    useGroupRescindMutation();
  const { mutate: cancelMutation, status: cancelStatus } =
    useGroupCancelMutation();
  const { mutate: leaveGroupMutation, status: leaveStatus } =
    useGroupLeaveMutation();

  const requested = gang && gang.claim && gang.claim.progress === 'knocking';
  const errored = gang && gang.claim && gang.claim.progress === 'error';
  const probablyOffline =
    gang && !gang.preview && gang.claim && gang.claim.progress === 'adding';
  const defaultView =
    !requested && !errored && !isJoining && !probablyOffline && !invited;

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requested) {
      rescindMutation({ flag });
    } else if (group && groupIsInitializing(group)) {
      leaveGroupMutation({ flag });
    } else {
      cancelMutation({ flag });
    }
  };

  let sideBarIcon;
  if (isJoining) {
    sideBarIcon = (
      <div className="flex items-center rounded-full bg-blue-soft p-1 text-blue">
        <LoadingSpinner className={isMobile ? 'h-3 w-3' : 'h-3 w-3'} />
        <p className="px-1 text-sm">Joining..</p>
      </div>
    );
  }

  if (requested) {
    sideBarIcon = (
      <p className="flex items-center rounded-full bg-blue-soft px-2 py-1 text-sm text-blue">
        Requested
      </p>
    );
  }

  if (errored || probablyOffline) {
    sideBarIcon = (
      <p className="flex items-center rounded-full bg-orange-soft px-2 py-1 text-orange">
        Tap to retry join
      </p>
    );
  }

  if (invited) {
    sideBarIcon = (
      <p className="flex items-center rounded-full bg-blue-soft px-2 py-1 text-sm text-blue">
        Invite
      </p>
    );
  }

  if (defaultView) {
    return (
      <SidebarItem
        icon={
          <GroupAvatar
            {...preview?.meta}
            size="h-12 w-12 sm:h-6 sm:w-6"
            className="opacity-60"
          />
        }
        actions={
          <GroupActions
            open={optionsOpen}
            onOpenChange={setOptionsOpen}
            flag={flag}
            triggerDisabled={isMobile}
          />
        }
        to={`/groups/${flag}`}
        {...handlers}
      >
        <span className="inline-block w-full truncate opacity-60">
          {preview ? preview.meta.title : flag}
        </span>
      </SidebarItem>
    );
  }

  if (invited) {
    return (
      <SidebarItem
        icon={<GroupAvatar {...preview?.meta} size="h-12 w-12 sm:h-6 sm:w-6" />}
        actions={
          invited ? (
            sideBarIcon
          ) : (
            <GroupActions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              flag={flag}
              triggerDisabled={isMobile}
            />
          )
        }
        to={`/gangs/${flag}`}
        state={{ backgroundLocation: location }}
        {...handlers}
      >
        <span className="inline-block w-full truncate">
          {preview ? preview.meta.title : flag}
        </span>
      </SidebarItem>
    );
  }

  return (
    <Popover.Root>
      <Popover.Anchor>
        <Popover.Trigger asChild>
          <SidebarItem
            icon={
              <GroupAvatar
                {...preview?.meta}
                size="h-12 w-12 sm:h-6 sm:w-6"
                className="opacity-60"
              />
            }
            actions={sideBarIcon}
          >
            <span className="w-full text-gray-300">
              {preview ? preview.meta.title : flag}
            </span>
          </SidebarItem>
        </Popover.Trigger>
      </Popover.Anchor>
      <Popover.Content
        side={isMobile ? 'bottom' : 'right'}
        sideOffset={isMobile ? 0 : 16}
        className="z-10"
      >
        <div className="flex w-[200px] flex-col space-y-4 rounded-lg bg-white p-4 leading-5 shadow-xl">
          <div className="absolute left-[172px] top-2.5">
            <Popover.Close>
              <X16Icon className="h-4 w-4 text-gray-400" />
            </Popover.Close>
          </div>
          {requested ? (
            <>
              <span>You&#39;ve requested to join this group.</span>
              <span>
                An admin will have to approve your request and then you&#39;ll
                receive an invitation to join.
              </span>
            </>
          ) : errored ? (
            <>
              <span>You were unable to join the group.</span>
              <span>
                The group may not exist or they may be running an incompatible
                version.
              </span>
            </>
          ) : probablyOffline ? (
            <>
              <span>Attempting to Join</span>
              <span>
                You&#39;re trying to join this group, but it can&#39;t be
                reached.
              </span>
            </>
          ) : (
            <>
              <span>You are currently joining this group.</span>
              <span>
                It may take a few minutes depending on the host&apos;s and your
                connection.
              </span>
              <button
                className="small-button bg-gray-50 text-gray-800"
                onClick={handleCancel}
              >
                {rescindStatus === 'loading' ||
                cancelStatus === 'loading' ||
                leaveStatus === 'loading' ? (
                  <LoadingSpinner className="h-5 w-4" />
                ) : (
                  'Cancel'
                )}
              </button>
            </>
          )}
          {(errored || requested || probablyOffline) && (
            <div className="flex">
              <Popover.Close>
                <button
                  className="small-button bg-gray-50 text-gray-800"
                  onClick={handleCancel}
                >
                  {rescindStatus === 'loading' || cancelStatus === 'loading' ? (
                    <>
                      Canceling...
                      <LoadingSpinner className="h-5 w-4" />
                    </>
                  ) : requested ? (
                    'Cancel Request'
                  ) : (
                    'Cancel Join'
                  )}
                </button>
              </Popover.Close>
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
