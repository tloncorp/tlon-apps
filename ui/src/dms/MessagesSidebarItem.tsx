import React from 'react';
import cn from 'classnames';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import DmOptions from './DMOptions';
import UnknownAvatarIcon from '../components/icons/UnknownAvatarIcon';
import { ChatBrief } from '../types/chat';
import { useMultiDm } from '../state/chat';
import { useChannel, useGroupState } from '../state/groups/groups';
import { useIsMobile } from '../logic/useMedia';
import useNavStore from '../components/Nav/useNavStore';
import GroupAvatar from '../groups/GroupAvatar';
import SidebarItem from '../components/Sidebar/SidebarItem';
import BulletIcon from '../components/icons/BulletIcon';
import MultiDmAvatar from './MultiDmAvatar';
import { whomIsDm, whomIsMultiDm } from '../logic/utils';

interface MessagesSidebarItemProps {
  whom: string;
  brief: ChatBrief;
  pending?: boolean; // eslint-disable-line
}

function ChannelSidebarItem({ whom, brief }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const groups = useGroupState((s) => s.groups);
  const groupFlag = Object.entries(groups).find(
    ([k, v]) => whom in v.channels
  )?.[0];
  const channel = useChannel(groupFlag || '', whom);

  if (!channel) {
    return null;
  }

  const img = channel.meta.image;
  return (
    <SidebarItem
      to={`/groups/${groupFlag}/channels/chat/${whom}`}
      icon={<GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" img={img} />}
      actions={
        (brief?.count ?? 0) > 0 ? (
          <BulletIcon
            className="h-6 w-6 text-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
            aria-label="Has Activity"
          />
        ) : null
      }
      onClick={() => isMobile && navPrimary('hidden')}
    >
      {channel.meta.title}
    </SidebarItem>
  );
}

function DMSidebarItem({ whom, brief, pending }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        pending ? (
          <UnknownAvatarIcon className="h-12 w-12 rounded-md text-blue sm:h-6 sm:w-6" />
        ) : (
          <Avatar size={isMobile ? 'default' : 'xs'} ship={whom} />
        )
      }
      actions={<DmOptions whom={whom} pending={!!pending} />}
      onClick={() => isMobile && navPrimary('hidden')}
    >
      <ShipName
        className="w-full truncate font-semibold"
        name={whom}
        showAlias
      />
    </SidebarItem>
  );
}

export function MultiDMSidebarItem({
  whom,
  brief,
  pending,
}: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const club = useMultiDm(whom);
  const allMembers = club?.team.concat(club.hive);
  const groupName = club?.meta.title || allMembers?.join(', ') || whom;

  if (club && !allMembers?.includes(window.our)) {
    return null;
  }

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        pending ? (
          <UnknownAvatarIcon className="h-12 w-12 rounded-md text-blue sm:h-6 sm:w-6" />
        ) : (
          <MultiDmAvatar size={isMobile ? 'default' : 'xs'} />
        )
      }
      actions={<DmOptions whom={whom} pending={!!pending} isMulti />}
      onClick={() => isMobile && navPrimary('hidden')}
    >
      {groupName}
    </SidebarItem>
  );
}

export default function MessagesSidebarItem({
  whom,
  brief,
  pending,
}: MessagesSidebarItemProps) {
  if (whomIsDm(whom)) {
    return <DMSidebarItem pending={pending} whom={whom} brief={brief} />;
  }

  if (whomIsMultiDm(whom)) {
    return <MultiDMSidebarItem whom={whom} brief={brief} pending={pending} />;
  }

  return <ChannelSidebarItem whom={whom} brief={brief} />;
}
