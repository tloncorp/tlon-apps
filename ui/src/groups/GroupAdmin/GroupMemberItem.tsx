import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useLocation } from 'react-router';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import CheckIcon from '@/components/icons/CheckIcon';
import ElipsisCircleIcon from '@/components/icons/EllipsisCircleIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import { toTitleCase, getSectTitle, getChannelHosts } from '@/logic/utils';
import {
  useAmAdmin,
  useGroup,
  useGroupAddSectsMutation,
  useGroupBanShipsMutation,
  useGroupDelMembersMutation,
  useGroupDelSectsMutation,
  useGroupFlag,
  useSects,
  useVessel,
} from '@/state/groups';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import { useContact } from '@/state/contact';
import { Vessel } from '@/types/groups';
import ConfirmationModal from '@/components/ConfirmationModal';

interface GroupMemberItemProps {
  member: string;
}

function GroupMemberItem({ member }: GroupMemberItemProps) {
  const [sectStatus, setSectStatus] = useState<
    'loading' | 'success' | 'error'
  >();
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [loadingKick, setLoadingKick] = useState(false);
  const [loadingBan, setLoadingBan] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const sects = useSects(flag);
  const isAdmin = useAmAdmin(flag);
  const vessel = useVessel(flag, member);
  const contact = useContact(member);
  const location = useLocation();
  const modalNavigate = useModalNavigate();
  const { mutate: delMembersMutation } = useGroupDelMembersMutation();
  const { mutate: banShipsMutation } = useGroupBanShipsMutation();
  const { mutate: delSectsMutation, status: delSectsStatus } =
    useGroupDelSectsMutation();
  const { mutate: addSectsMutation, status: addSectsStatus } =
    useGroupAddSectsMutation();

  useEffect(() => {
    if (delSectsStatus === 'success' || addSectsStatus === 'success') {
      setSectStatus('success');
    } else if (delSectsStatus === 'error' || addSectsStatus === 'error') {
      setSectStatus('error');
    } else if (delSectsStatus === 'loading' || addSectsStatus === 'loading') {
      setSectStatus('loading');
    }
  }, [delSectsStatus, addSectsStatus]);

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const kick = useCallback(
    (ship: string) => async () => {
      setLoadingKick(true);
      delMembersMutation({ flag, ships: [ship] });
      setLoadingKick(false);
    },
    [flag, delMembersMutation]
  );

  const ban = useCallback(
    (ship: string) => async () => {
      setLoadingBan(true);
      banShipsMutation({ flag, ships: [ship] });
      setLoadingBan(false);
    },
    [flag, banShipsMutation]
  );

  const toggleSect = useCallback(
    (ship: string, sect: string, v: Vessel) => async (event: Event) => {
      event.preventDefault();

      const inSect = v.sects.includes(sect);
      const isOwner = flag.includes(ship);

      if (inSect && sect === 'admin' && isOwner) {
        setSectStatus('error');
        return;
      }
      if (inSect) {
        try {
          delSectsMutation({ flag, ship, sects: [sect] });
          setSectStatus('success');
        } catch (e) {
          setSectStatus('error');
          console.error(e);
        }
      } else {
        try {
          addSectsMutation({ flag, ship, sects: [sect] });
          setSectStatus('success');
        } catch (e) {
          setSectStatus('error');
          console.log(e);
        }
      }
    },
    [flag, delSectsMutation, addSectsMutation]
  );

  if (!group) {
    return null;
  }

  const isHost = getChannelHosts(group).includes(member);

  return (
    <>
      <div className="cursor-pointer" onClick={() => onViewProfile(member)}>
        <Avatar ship={member} size="small" icon={false} className="mr-2" />
      </div>
      <div className="flex flex-1 flex-col space-y-0.5">
        <h2>
          {contact?.nickname ? contact.nickname : <ShipName name={member} />}
        </h2>
        {contact?.nickname ? (
          <p className="text-sm text-gray-400">{member}</p>
        ) : null}
      </div>
      {isHost && (
        <div className="mr-2 rounded border border-green-500 px-2 py-0.5 text-xs font-medium uppercase text-green-500">
          Host
        </div>
      )}
      {isAdmin && vessel ? (
        <Dropdown.Root>
          <Dropdown.Trigger className="small-secondary-button default-focus mr-2 flex max-w-xs items-center whitespace-nowrap">
            {vessel.sects.length > 3
              ? `${vessel.sects.length} Roles`
              : vessel.sects
                  .map((s) => toTitleCase(getSectTitle(group.cabals, s)))
                  .concat('Member')
                  .join(', ')}
            <CaretDown16Icon className="ml-2 h-4 w-4" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            {sects.map((s) => (
              <Dropdown.Item
                key={s}
                className={cn(
                  'dropdown-item flex items-center',
                  !vessel.sects.includes(s) && 'text-gray-800'
                )}
                onSelect={toggleSect(member, s, vessel)}
              >
                {sectStatus === 'loading' ? (
                  <div className="mr-2 flex h-6 w-6 items-center justify-center">
                    <LoadingSpinner className="h-4 w-4" />
                  </div>
                ) : vessel.sects.includes(s) ? (
                  <CheckIcon className="mr-2 h-6 w-6 text-green" />
                ) : (
                  <div className="mr-2 h-6 w-6" />
                )}
                {getSectTitle(group.cabals, s)}
              </Dropdown.Item>
            ))}
            <Dropdown.Item
              className={cn('dropdown-item flex items-center', 'text-gray-800')}
            >
              <CheckIcon className="mr-2 h-6 w-6 text-green" />
              Member
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      ) : null}
      {isAdmin && !isHost ? (
        <Dropdown.Root>
          {member !== window.our ? (
            <Dropdown.Trigger className="default-focus ml-auto text-gray-800">
              <ElipsisIcon className="h-6 w-6" />
            </Dropdown.Trigger>
          ) : (
            <div className="h-6 w-6" />
          )}
          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            <Dropdown.Item
              className="dropdown-item flex items-center text-red"
              onSelect={() => setShowKickConfirm(true)}
            >
              <LeaveIcon className="mr-2 h-6 w-6" />
              Kick
            </Dropdown.Item>
            <Dropdown.Item
              className="dropdown-item flex items-center text-red"
              onSelect={() => setShowBanConfirm(true)}
            >
              <LeaveIcon className="mr-2 h-6 w-6" />
              Ban
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      ) : (
        <Dropdown.Root>
          <Dropdown.Trigger className="default-focus ml-auto rounded text-gray-800">
            <ElipsisIcon className="h-6 w-6" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            <Dropdown.Item
              className="dropdown-item flex items-center"
              onSelect={() => onViewProfile(member)}
            >
              View Profile
            </Dropdown.Item>
            <Dropdown.Item
              className="dropdown-item flex items-center"
              onSelect={(e) => e.preventDefault}
            >
              Send Message
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      )}
      <ConfirmationModal
        title="Kick Member"
        message={`Are you sure you want to kick ${member}?`}
        confirmText="Kick"
        loading={loadingKick}
        onConfirm={kick(member)}
        open={showKickConfirm}
        setOpen={setShowKickConfirm}
      />
      <ConfirmationModal
        title="Ban Member"
        message={`Are you sure you want to ban ${member}?`}
        confirmText="Ban"
        loading={loadingBan}
        onConfirm={ban(member)}
        open={showBanConfirm}
        setOpen={setShowBanConfirm}
      />
    </>
  );
}

export default React.memo(GroupMemberItem);
