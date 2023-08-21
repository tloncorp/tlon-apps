import ActionMenu, { Action } from '@/components/ActionMenu';
import Avatar from '@/components/Avatar';
import ConfirmationModal from '@/components/ConfirmationModal';
import Divider from '@/components/Divider';
import MobileHeader from '@/components/MobileHeader';
import ShipName from '@/components/ShipName';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useModalNavigate } from '@/logic/routing';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { toTitleCase, getSectTitle } from '@/logic/utils';
import { useContact } from '@/state/contact';
import {
  useRouteGroup,
  useGroup,
  useGroupBanShipsMutation,
  useGroupDelMembersMutation,
  useGroupFlag,
  useAmAdmin,
  useVessel,
} from '@/state/groups';
import _ from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router';

interface GroupMemberItemProps {
  member: string;
}

const Member = React.memo(({ member }: GroupMemberItemProps) => {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const [isOpen, setIsOpen] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [loadingKick, setLoadingKick] = useState(false);
  const [loadingBan, setLoadingBan] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const contact = useContact(member);
  const vessel = useVessel(flag, member);
  const actions: Action[] = [];
  const location = useLocation();
  const modalNavigate = useModalNavigate();
  const navigateByApp = useNavigateByApp();
  const { mutate: delMembersMutation } = useGroupDelMembersMutation();
  const { mutate: banShipsMutation } = useGroupBanShipsMutation();

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const onSendMessage = (ship: string) => {
    navigateByApp(`/dm/${ship}`);
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

  actions.push(
    {
      key: 'profile',
      content: 'View Profile',
      onClick: () => onViewProfile(member),
    },
    /* TODO: navigate here by app if we're not in the mobile app,
       otherwise open the DM */
    {
      key: 'message',
      content: 'Send Message',
      onClick: () => onSendMessage(member),
    }
  );

  /* TODO: this check doesn't work,
     also need to wrap in a saga-compatibility check */
  if (member !== window.ship && isAdmin) {
    actions.push(
      {
        key: 'kick',
        content: 'Kick',
        type: 'destructive',
        onClick: () => setShowKickConfirm(true),
      },
      {
        key: 'ban',
        content: 'Ban',
        type: 'destructive',
        onClick: () => setShowBanConfirm(true),
      }
    );
  }

  /* TODO: role assignment actions */

  return (
    <>
      <ActionMenu
        className="w-full"
        open={isOpen}
        onOpenChange={setIsOpen}
        actions={actions}
      >
        <SidebarItem
          icon={<Avatar ship={member} size="default" icon={false} />}
          key={member}
        >
          {contact?.nickname ? (
            contact.nickname
          ) : (
            <ShipName name={member} full />
          )}
          {group && (
            <div className="mt-1 text-sm font-normal text-gray-400">
              {vessel.sects.length > 0
                ? _.pull(vessel.sects, 'member').map((s) => (
                    <span key={s} className="mr-1">
                      {toTitleCase(getSectTitle(group.cabals, s))}
                    </span>
                  ))
                : null}
            </div>
          )}
        </SidebarItem>
      </ActionMenu>
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
});

export default function Members() {
  const flag = useRouteGroup();
  const group = useGroup(flag, true);
  const members = useMemo(() => {
    if (!group) {
      return [];
    }
    return Object.keys(group.fleet).filter((k) => {
      if ('shut' in group.cordon) {
        return (
          !group.cordon.shut.ask.includes(k) &&
          !group.cordon.shut.pending.includes(k)
        );
      }
      if (group.fleet[k].sects.includes('admin')) {
        return false;
      }
      return true;
    });
  }, [group]);

  const admins = useMemo(() => {
    if (!group) {
      return [];
    }
    return Object.keys(group.fleet).filter((k) => {
      if (group.fleet[k].sects.includes('admin')) {
        return true;
      }
      return false;
    });
  }, [group]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <MobileHeader title="Members" pathBack=".." />
      <div className="h-full overflow-auto px-4">
        <Divider isMobile={true}>Admin</Divider>
        {admins.map((admin) => (
          <Member member={admin} />
        ))}
        <Divider isMobile={true}>Everyone else</Divider>
        {members.map((member) => (
          <Member member={member} />
        ))}
      </div>
    </div>
  );
}
