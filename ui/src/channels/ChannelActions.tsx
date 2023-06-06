import { useState, useCallback } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import DeleteChannelModal from '@/groups/ChannelsList/DeleteChannelModal';
import EditChannelModal from '@/groups/ChannelsList/EditChannelModal';
import { Status } from '@/logic/status';
import useIsChannelHost from '@/logic/useIsChannelHost';
import { useIsMobile } from '@/logic/useMedia';
import { nestToFlag, getFlagParts } from '@/logic/utils';
import { useRouteGroup, useDeleteChannelMutation } from '@/state/groups';
import { GroupChannel } from '@/types/groups';

interface ChannelActionsProps {
  nest: string;
  prettyAppName: string;
  channel: GroupChannel | undefined;
  isAdmin: boolean | undefined;
  leave: (flag: string) => Promise<void>;
}

export default function ChannelActions({
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
            className="flex h-6 w-6 items-center justify-center rounded  text-gray-600 hover:bg-gray-50"
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
                className="dropdown-item-red"
                onClick={() => setDeleteChannelIsOpen(!deleteChannelIsOpen)}
              >
                Delete {prettyAppName}
              </Dropdown.Item>
            </>
          )}
          {!isChannelHost && (
            <Dropdown.Item className="dropdown-item-red" onClick={leaveChannel}>
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
