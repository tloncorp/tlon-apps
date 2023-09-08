import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import {
  useGang,
  useGroupCancelMutation,
  useGroupRescindMutation,
} from '@/state/groups';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import SidebarItem from './SidebarItem';

// Gang is a pending group invite
export default function GangItem(props: { flag: string }) {
  const { flag } = props;
  const { preview, claim } = useGang(flag);
  const isMobile = useIsMobile();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { action, handlers } = useLongPress();

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

  if (!claim) {
    return null;
  }

  const requested = claim.progress === 'knocking';
  const errored = claim.progress === 'error';
  const handleCancel = async () => {
    if (requested) {
      rescindMutation({ flag });
    } else {
      cancelMutation({ flag });
    }
  };

  if (!requested && !errored) {
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
        className="px-4"
        to={`/groups/${flag}`}
        {...handlers}
      >
        <span className="inline-block w-full truncate opacity-60">
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
            className="px-4"
          >
            <span className="inline-block w-full truncate opacity-60">
              {preview ? preview.meta.title : flag}
            </span>
          </SidebarItem>
        </Popover.Trigger>
      </Popover.Anchor>
      <Popover.Content
        side={isMobile ? 'top' : 'right'}
        sideOffset={isMobile ? 0 : 16}
        className="z-10"
      >
        <div className="flex w-[200px] flex-col space-y-4 rounded-lg bg-white p-4 leading-5 shadow-xl">
          {requested ? (
            <>
              <span>You've requested to join this group.</span>
              <span>
                An admin will have to approve your request and then you'll
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
                {rescindStatus === 'loading' || cancelStatus === 'loading' ? (
                  <LoadingSpinner className="h-5 w-4" />
                ) : (
                  'Cancel'
                )}
              </button>
            </>
          )}
          {(errored || requested) && (
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
