import { GroupChannel } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import ActionMenu, { Action } from '@/components/ActionMenu';
import VolumeSetting from '@/components/VolumeSetting';
import WidgetDrawer from '@/components/WidgetDrawer';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import GroupAvatar from '@/groups/GroupAvatar';
import { useIsChannelHost } from '@/logic/channel';
import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
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

import ChannelHostConnection from './ChannelHostConnection';
import EditChannelForm from './EditChannelForm';

export default function ChannelInfo(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dismiss = useDismissNavigate();

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

  const location = useLocation();
  const groupFlag = useRouteGroup();

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

  // const { mutateAsync: leave } = useLeaveMutation();
  // const { mutate: deleteChannelMutate } = useDeleteChannelMutation();

  // const [editIsOpen, setEditIsOpen] = useState(false);
  // const [deleteChannelIsOpen, setDeleteChannelIsOpen] = useState(false);
  // const [deleteStatus, setDeleteStatus] = useState<Status>('initial');
  // const [showNotifications, setShowNotifications] = useState(false);

  // const navigate = useNavigate();

  // const [navigationStarted, setNavigationStarted] = useState(false);

  // const buttonClasses =
  //   'w-full flex justify-center items-center flex-col text-center p-3 text-sm bg-gray-50 rounded-lg space-y-2';

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
              {!isChannelHost && (
                <button className="button">Leave {channel?.meta.title}</button>
              )}
            </div>
          </>
        )}

        {view === 'volume' && <VolumeSheet back={() => setView('root')} />}
        {view === 'edit' && <EditSheet back={() => setView('root')} />}
        {view === 'delete' && <DeleteSheet back={() => setView('root')} />}
      </div>
    </WidgetDrawer>
  );
}

export function VolumeSheet(props: { back: () => void }) {
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
      <div>set volume</div>
    </div>
  );
}

export function EditSheet(props: { back: () => void }) {
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
      <div>channel info form</div>
    </div>
  );
}

export function DeleteSheet(props: { back: () => void }) {
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
      <div>Confirm you want to delete channel</div>
    </div>
  );
}
