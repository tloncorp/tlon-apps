import GroupAvatar from '@/groups/GroupAvatar';
import { useIsMobile } from '@/logic/useMedia';
import useRequestState from '@/logic/useRequestState';
import { useGang, useGroupState } from '@/state/groups';
import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import SidebarItem from './SidebarItem';

// Gang is a pending group invite
export default function GangItem(props: { flag: string }) {
  const { flag } = props;
  const { preview, claim } = useGang(flag);
  const { isPending, setPending, setReady } = useRequestState();
  const isMobile = useIsMobile();

  if (!claim) {
    return null;
  }

  const requested = claim.progress === 'knocking';
  const errored = claim.progress === 'error';
  const handleCancel = async () => {
    setPending();
    if (requested) {
      await useGroupState.getState().rescind(flag);
      setReady();
    } else {
      await useGroupState.getState().cancel(flag);
      setReady();
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
              <button
                className="small-button bg-gray-50 text-gray-800"
                onClick={handleCancel}
              >
                {isPending ? (
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
            </>
          )}
          {(errored || requested) && (
            <div className="flex">
              <Popover.Close>
                <button
                  className="small-button bg-gray-50 text-gray-800"
                  onClick={handleCancel}
                >
                  {isPending ? (
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
