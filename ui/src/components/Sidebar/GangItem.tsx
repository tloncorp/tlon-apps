import GroupAvatar from '@/groups/GroupAvatar';
import { useIsMobile } from '@/logic/useMedia';
import { useGang, useGroupState } from '@/state/groups';
import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import SidebarItem from './SidebarItem';

// Gang is a pending group invite
export default function GangItem(props: { flag: string }) {
  const { flag } = props;
  const { preview, claim } = useGang(flag);
  const isMobile = useIsMobile();

  if (!claim) {
    return null;
  }

  const requested = claim.progress === 'knocking';
  const errored = claim.progress === 'error';
  const handleCancel = async () => {
    if (requested) {
      await useGroupState.getState().rescind(flag);
    } else {
      await useGroupState.getState().cancel(flag);
    }
  };

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
        <div className="flex w-[200px] flex-col space-y-4 rounded-lg bg-white p-4 leading-5 drop-shadow-lg">
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
            </>
          )}
          {(errored || requested) && (
            <div className="flex">
              <Popover.Close>
                <button
                  className="small-button bg-gray-50 text-gray-800"
                  onClick={handleCancel}
                >
                  {requested ? 'Cancel Request' : 'Cancel Join'}
                </button>
              </Popover.Close>
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
