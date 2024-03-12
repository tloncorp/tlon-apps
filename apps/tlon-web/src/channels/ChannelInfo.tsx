import { GroupChannel } from '@tloncorp/shared/dist/urbit/groups';
import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import useActiveTab from '@/components/Sidebar/util';
import VolumeSetting from '@/components/VolumeSetting';
import WidgetDrawer from '@/components/WidgetDrawer';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import GroupAvatar from '@/groups/GroupAvatar';
import { useIsChannelHost } from '@/logic/channel';
import { useDismissNavigate } from '@/logic/routing';
import { Status } from '@/logic/status';
import { useIsMobile } from '@/logic/useMedia';
import { useLeaveMutation } from '@/state/channel/channel';
import {
  useAmAdmin,
  useDeleteChannelMutation,
  useGroup,
  useGroupChannel,
  useRouteGroup,
} from '@/state/groups';

import EditChannelForm from './EditChannelForm';

export default function ChannelInfo(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dismiss = useDismissNavigate();
  const navigate = useNavigate();
  const groupFlag = useRouteGroup();
  const activeTab = useActiveTab();
  const { chType, chShip, chName } = useParams<{
    chType: string;
    chShip: string;
    chName: string;
  }>();
  const nest = `${chType}/${chShip}/${chName}`;
  const chFlag = `${chShip}/${chName}`;
  const group = useGroup(groupFlag);
  const channel = useGroupChannel(groupFlag, nest);
  const isMobile = useIsMobile();
  const isAdmin = useAmAdmin(groupFlag);
  const isChannelHost = useIsChannelHost(chFlag);
  const { mutate: deleteChannelMutate } = useDeleteChannelMutation();
  const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  const { mutateAsync: leave } = useLeaveMutation();
  const [view, setView] = useState<'root' | 'volume' | 'edit' | 'delete'>(
    'root'
  );

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
      setView('root');
    }
    if (props.onOpenChange) {
      props.onOpenChange(open);
    }
  };

  const delayedViewNav = (newView: 'root' | 'volume' | 'edit' | 'delete') => {
    setTimeout(() => {
      setView(newView);
    }, 100);
  };

  const leaveChannel = useCallback(async () => {
    try {
      leave({ nest });
      navigate(
        isMobile
          ? `/groups/${groupFlag}`
          : activeTab === 'messages'
            ? `/messages`
            : `/groups/${groupFlag}/channels`
      );
    } catch (error) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[ChannelHeader:LeaveError] ${error}`);
      }
    }
  }, [leave, nest, navigate, isMobile, groupFlag, activeTab]);

  const onDeleteChannelConfirm = useCallback(async () => {
    setDeleteStatus('loading');
    try {
      deleteChannelMutate({ flag: groupFlag, nest });
      navigate(
        isMobile ? `/groups/${groupFlag}` : `/groups/${groupFlag}/channels`
      );
      setDeleteStatus('success');
      setDeleteChannelIsOpen(!deleteChannelIsOpen);
    } catch (error) {
      setDeleteStatus('error');
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [
    deleteChannelMutate,
    groupFlag,
    nest,
    navigate,
    isMobile,
    deleteChannelIsOpen,
  ]);

  return (
    <WidgetDrawer
      open={props.open || true}
      onOpenChange={onOpenChange}
      className="h-[80vh]"
      withGrabber={true}
    >
      <div className="mt-6 flex h-full flex-col space-y-3 overflow-y-auto">
        {view === 'root' && (
          <>
            <div className="flex w-full items-center space-x-2 px-6 py-2">
              <GroupAvatar size="h-10 w-10" {...group?.meta} />
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold">{channel?.meta.title}</h1>
                <p className="text-gray-400">{group?.meta.title}</p>
              </div>
            </div>
            <div className="flex flex-col items-stretch justify-center space-y-3 px-6">
              <button
                className="button"
                onClick={() => delayedViewNav('volume')}
              >
                Set Notifications for {channel?.meta.title}
              </button>
              {!isChannelHost && (
                <button className="button" onClick={leaveChannel}>
                  Leave {channel?.meta.title}
                </button>
              )}
              {isAdmin && (
                <button
                  className="button"
                  onClick={() => delayedViewNav('edit')}
                >
                  Edit {channel?.meta.title}
                </button>
              )}
              {isAdmin && (
                <button
                  className="button"
                  onClick={() => delayedViewNav('delete')}
                >
                  Delete {channel?.meta.title}
                </button>
              )}
            </div>
          </>
        )}

        {view === 'volume' && (
          <VolumeSheet nest={nest} back={() => setView('root')} />
        )}
        {view === 'edit' && channel && (
          <EditSheet
            nest={nest}
            channel={channel}
            back={() => setView('root')}
          />
        )}
        {view === 'delete' && channel && (
          <DeleteSheet
            deleteStatus={deleteStatus}
            onDeleteChannelConfirm={onDeleteChannelConfirm}
            channel={channel}
            back={() => setView('root')}
          />
        )}
      </div>
    </WidgetDrawer>
  );
}

export function VolumeSheet(props: { back: () => void; nest: string }) {
  return (
    <div className="flex w-full flex-col items-center px-6 py-2">
      <div className="mb-4 flex w-full items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">Set Volume</h3>
        <div className="invisible h-6 w-6" />
      </div>
      <VolumeSetting scope={{ channel: props.nest }} />
    </div>
  );
}

export function EditSheet(props: {
  back: () => void;
  nest: string;
  channel: GroupChannel;
}) {
  return (
    <div className="flex w-full flex-col items-center px-6 py-2">
      <div className="mb-4 flex w-full items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">Edit Channel</h3>
        <div className="invisible h-6 w-6" />
      </div>
      <div className="w-full">
        <EditChannelForm
          nest={props.nest}
          channel={props.channel}
          redirect={false}
        />
      </div>
    </div>
  );
}

export function DeleteSheet(props: {
  back: () => void;
  channel: GroupChannel;
  deleteStatus: Status;
  onDeleteChannelConfirm: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center px-6 py-2">
      <div className="mb-4 flex w-full items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">Delete Channel</h3>
        <div className="invisible h-6 w-6" />
      </div>
      <div>
        <p className="leading-5">
          Are you sure you want to delete “{props.channel.meta.title}”? This
          will also delete the channel for everyone in the group.
        </p>
        <div className="mt-4 flex flex-col items-center space-y-3">
          <button className="secondary-button w-full">Cancel</button>
          <button
            onClick={() => props.onDeleteChannelConfirm()}
            className="button w-full bg-red text-white"
            disabled={props.deleteStatus === 'loading'}
          >
            {props.deleteStatus === 'loading' ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : props.deleteStatus === 'error' ? (
              'Error'
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
