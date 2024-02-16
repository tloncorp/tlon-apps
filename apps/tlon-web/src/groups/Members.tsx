import ActionMenu, { Action } from '@/components/ActionMenu';
import Avatar from '@/components/Avatar';
import ConfirmationModal from '@/components/ConfirmationModal';
import Divider from '@/components/Divider';
import MobileHeader from '@/components/MobileHeader';
import RoleBadges from '@/components/RoleBadges';
import ShipName from '@/components/ShipName';
import ShipScroller from '@/components/ShipScroller';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import XIcon from '@/components/icons/XIcon';
import { useIsMobile } from '@/logic/useMedia';
import { useContact } from '@/state/contact';
import {
  useAmAdmin,
  useGroup,
  useGroupBanShipsMutation,
  useGroupCompatibility,
  useGroupDelMembersMutation,
  useGroupFlag,
  useRouteGroup,
  useSects,
} from '@/state/groups';
import { deSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import { debounce } from 'lodash';
import React, {
  ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';

import RoleSelect from './RoleInput/RoleSelector';
import SetRolesDialog from './RoleInput/SetRolesDialog';

interface GroupMemberItemProps {
  ship: string;
}

const Member = React.memo(({ ship: member }: GroupMemberItemProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const sects = useSects(flag);
  const { compatible } = useGroupCompatibility(flag);
  const isAdmin = useAmAdmin(flag);
  const [isOpen, setIsOpen] = useState(false);
  const [rolesIsOpen, setRolesIsOpen] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [loadingKick, setLoadingKick] = useState(false);
  const [loadingBan, setLoadingBan] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const contact = useContact(member);
  const location = useLocation();
  const { mutate: delMembersMutation } = useGroupDelMembersMutation();
  const { mutate: banShipsMutation } = useGroupBanShipsMutation();

  const onViewProfile = (ship: string) => {
    navigate(`/profile/${ship}`, {
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

  const actions: Action[] = [
    {
      key: 'profile',
      content: 'View Profile',
      onClick: () => onViewProfile(member),
    },
    {
      key: 'message',
      content: 'Send Message',
      onClick: () => onSendMessage(member),
    },
  ];

  if (!group) {
    return null;
  }

  const roleActions: Action[] = sects.map((s) => ({
    key: s,
    content: <RoleSelect role={s} member={member} />,
    keepOpenOnClick: true,
  }));

  if (member !== window.our && isAdmin && compatible) {
    actions.push(
      {
        key: 'set-role',
        content: 'Set Role',
        onClick: () => {
          setIsOpen(false);
          setRolesIsOpen(true);
        },
      },
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

  return (
    <div key={member}>
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
          <div className="flex h-full w-full flex-col items-start justify-center">
            {contact?.nickname ? (
              contact.nickname
            ) : (
              <ShipName name={member} full />
            )}
            <RoleBadges ship={member} inList />
          </div>
        </SidebarItem>
      </ActionMenu>
      {isMobile ? (
        <ActionMenu
          className="w-full"
          open={rolesIsOpen}
          onOpenChange={setRolesIsOpen}
          actions={roleActions}
        />
      ) : (
        <SetRolesDialog
          className="min-w-[300px]"
          open={rolesIsOpen}
          onOpenChange={setRolesIsOpen}
          member={member}
          roles={sects}
        />
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
    </div>
  );
});

export default function Members() {
  const [toggleSearch, setToggleSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [rawInput, setRawInput] = useState('');
  const onUpdate = useRef(
    debounce((value: string) => {
      setSearch(value);
    }, 150)
  );
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

  const results = useMemo(
    () =>
      fuzzy
        .filter(search, members)
        .sort((a, b) => {
          const filter = deSig(search) || '';
          const left = deSig(a.string)?.startsWith(filter)
            ? a.score + 1
            : a.score;
          const right = deSig(b.string)?.startsWith(filter)
            ? b.score + 1
            : b.score;

          return right - left;
        })
        .map((result) => members[result.index]),
    [search, members]
  );

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setRawInput(value);
    onUpdate.current(value);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <MobileHeader
        title={
          !toggleSearch ? (
            'Members'
          ) : (
            <input
              autoFocus
              className="input"
              placeholder="Filter Members"
              value={rawInput}
              onChange={onChange}
            />
          )
        }
        pathBack=".."
        action={
          <div className="flex h-12 flex-row items-center justify-end space-x-2">
            <button onClick={() => setToggleSearch(!toggleSearch)}>
              {toggleSearch ? (
                <XIcon className="h-6 w-6 text-gray-800" />
              ) : (
                <MagnifyingGlassMobileNavIcon className="h-6 w-6 text-gray-800" />
              )}
            </button>
          </div>
        }
      />
      <div className="h-full overflow-auto px-4">
        <Divider isMobile={true}>Admin</Divider>
        {admins.map((admin) => (
          <Member key={admin} ship={admin} />
        ))}
        <Divider isMobile={true}>Everyone else</Divider>
        {results.length === 0 ? (
          <p className="mt-4 text-center text-gray-400">
            No members match your search
          </p>
        ) : null}
        <ShipScroller shipLabel="member" shipItem={Member} ships={results} />
      </div>
    </div>
  );
}
