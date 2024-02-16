import * as Dropdown from '@radix-ui/react-dropdown-menu';
import cn from 'classnames';
import _ from 'lodash';
import React, { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import Avatar from '@/components/Avatar';
import ConfirmationModal from '@/components/ConfirmationModal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import AddBadgeIcon from '@/components/icons/AddBadgeIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { getChannelHosts } from '@/logic/channel';
import { useModalNavigate } from '@/logic/routing';
import { getSectTitle, toTitleCase } from '@/logic/utils';
import { useContact } from '@/state/contact';
import {
  useAmAdmin,
  useGroup,
  useGroupBanShipsMutation,
  useGroupCompatibility,
  useGroupDelMembersMutation,
  useGroupFlag,
  useGroupSectMutation,
  useSects,
  useVessel,
} from '@/state/groups';
import { Vessel } from '@/types/groups';

interface GroupMemberItemProps {
  member: string;
}

function GroupMemberItem({ member }: GroupMemberItemProps) {
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [loadingKick, setLoadingKick] = useState(false);
  const [loadingBan, setLoadingBan] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const adminRef = useRef(document.getElementById('admin-dialog'));
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const sects = useSects(flag);
  const isAdmin = useAmAdmin(flag);
  const vessel = useVessel(flag, member);
  const contact = useContact(member);
  const location = useLocation();
  const modalNavigate = useModalNavigate();
  const navigate = useNavigate();
  const { compatible } = useGroupCompatibility(flag);
  const { mutate: delMembersMutation } = useGroupDelMembersMutation();
  const { mutate: banShipsMutation } = useGroupBanShipsMutation();
  const { mutateAsync: sectMutation } = useGroupSectMutation();
  const [sectLoading, setSectLoading] = useState('');

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const onSendMessage = (ship: string) => {
    navigate(`/dm/${ship}`);
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

      if (inSect && sect === 'admin' && flag.includes(ship)) {
        setIsOwner(true);
        return;
      }
      if (inSect) {
        try {
          setSectLoading(sect);
          await sectMutation({ flag, ship, sects: [sect], operation: 'del' });
          setSectLoading('');
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          setSectLoading(sect);
          await sectMutation({ flag, ship, sects: [sect], operation: 'add' });
          setSectLoading('');
        } catch (e) {
          console.log(e);
        }
      }
    },
    [flag, sectMutation]
  );

  if (!group) {
    return null;
  }

  const isHost = getChannelHosts(group).includes(member);

  return (
    <>
      <div className="flex flex-col" data-testid={`${member}-row`}>
        <div className="flex space-x-2">
          <div className="cursor-pointer" onClick={() => onViewProfile(member)}>
            <Avatar ship={member} size="small" icon={false} className="mr-2" />
          </div>
          <div className="flex flex-col">
            <div className="flex w-full flex-row items-center justify-between space-x-2">
              <h2 className="font-semibold">
                {contact?.nickname ? (
                  contact.nickname
                ) : (
                  <ShipName name={member} full />
                )}
              </h2>
              {contact?.nickname ? (
                <ShipName name={member} full className="text-gray-400" />
              ) : null}
            </div>
            {isHost ? (
              <div className="py-1 text-sm font-semibold text-orange">Host</div>
            ) : (
              <div className="py-0.5 text-sm font-semibold text-gray-400">
                {vessel.sects.length > 0
                  ? _.pull(vessel.sects, 'member').map((s) => (
                      <span key={s} className="mr-1">
                        {toTitleCase(getSectTitle(group.cabals, s))}
                      </span>
                    ))
                  : 'Member'}
              </div>
            )}
          </div>
        </div>
      </div>
      {isAdmin && vessel ? (
        <Dropdown.Root>
          <Dropdown.Trigger
            className={cn(
              'default-focus ml-auto items-center text-gray-600 opacity-0',
              !compatible
                ? 'cursor-not-allowed group-hover:opacity-20'
                : 'group-hover:opacity-100'
            )}
            disabled={!compatible}
          >
            <AddBadgeIcon className="h-6 w-6" />
          </Dropdown.Trigger>
          <Dropdown.Content
            className="dropdown min-w-52 text-gray-800"
            avoidCollisions={true}
            collisionBoundary={adminRef.current}
          >
            {sects.map((s) => (
              <Dropdown.Item
                key={s}
                className={cn('dropdown-item flex items-center space-x-1')}
                onSelect={toggleSect(member, s, vessel)}
              >
                {sectLoading === s ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : isOwner ? (
                  <ExclamationPoint className="h-4 w-4 text-red" />
                ) : vessel.sects.includes(s) ? (
                  <CheckIcon className="h-4 w-4" />
                ) : null}
                <span>{getSectTitle(group.cabals, s)}</span>
              </Dropdown.Item>
            ))}
          </Dropdown.Content>
        </Dropdown.Root>
      ) : null}
      {isAdmin && !isHost ? (
        <Dropdown.Root>
          {member !== window.our ? (
            <Dropdown.Trigger
              className={cn(
                'default-focus ml-2 text-gray-400',
                !compatible ? 'cursor-not-allowed' : 'group-hover:text-gray-800'
              )}
              disabled={!compatible}
            >
              <ElipsisIcon className="h-6 w-6" />
            </Dropdown.Trigger>
          ) : (
            <div className="h-6 w-6" />
          )}
          <Dropdown.Portal>
            <Dropdown.Content className="dropdown z-50 min-w-52">
              <Dropdown.Item
                className="dropdown-item-red"
                onSelect={() => setShowKickConfirm(true)}
              >
                Kick
              </Dropdown.Item>
              <Dropdown.Item
                className="dropdown-item-red"
                onSelect={() => setShowBanConfirm(true)}
              >
                Ban
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      ) : (
        <Dropdown.Root>
          <Dropdown.Trigger className="default-focus ml-2 rounded text-gray-400 group-hover:text-gray-800">
            <ElipsisIcon className="h-6 w-6" />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content className="dropdown z-50 min-w-52">
              <Dropdown.Item
                className="dropdown-item flex items-center"
                onSelect={() => onViewProfile(member)}
              >
                View Profile
              </Dropdown.Item>
              <Dropdown.Item
                className="dropdown-item flex items-center"
                onSelect={() => onSendMessage(member)}
              >
                Send Message
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
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
