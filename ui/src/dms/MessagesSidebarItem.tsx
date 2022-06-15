import React from 'react';
import cn from 'classnames';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import DmOptions from './DMOptions';
import UnknownAvatarIcon from '../components/icons/UnknownAvatarIcon';
import { ChatBrief } from '../types/chat';
import { isDMBrief } from '../state/chat';
import { useChannel, useGroupState } from '../state/groups';
import { useIsMobile } from '../logic/useMedia';
import useNavStore from '../components/Nav/useNavStore';
import GroupAvatar from '../components/GroupAvatar';
import SidebarItem from '../components/Sidebar/SidebarItem';

interface MessagesSidebarItemProps {
  whom: string;
  brief: ChatBrief;
  pending?: boolean; // eslint-disable-line
}

function ChannelSidebarItem({ whom, brief }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const hideNav = useNavStore((state) => state.setLocationHidden);
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
      hasActivity={(brief?.count ?? 0) > 0}
      onClick={() => isMobile && hideNav()}
    >
      <h3 className="ml-3">{channel.meta.title}</h3>
    </SidebarItem>
  );
}

function DMSidebarItem({ whom, brief, pending }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const hideNav = useNavStore((state) => state.setLocationHidden);

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
      actions={<DmOptions ship={whom} />}
      hasActivity={(brief?.count ?? 0) > 0 || pending}
      onClick={() => isMobile && hideNav()}
    >
      <ShipName className="ml-2 font-semibold" name={whom} showAlias />
    </SidebarItem>
  );
}

export default function MessagesSidebarItem({
  whom,
  brief,
  pending,
}: MessagesSidebarItemProps) {
  const isDM = isDMBrief(whom);
  if (isDM) {
    return <DMSidebarItem pending={pending} whom={whom} brief={brief} />;
  }

  return <ChannelSidebarItem whom={whom} brief={brief} />;
}
