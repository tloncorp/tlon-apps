import React from 'react';
import cn from 'classnames';
import { NavLink } from 'react-router-dom';
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
    <li className="group relative flex items-center justify-between rounded-lg font-semibold text-gray-600">
      <NavLink
        to={`/groups/${groupFlag}/channels/chat/${whom}`}
        className="default-focus flex flex-1 items-center rounded-lg p-2"
        onClick={() => isMobile && hideNav()}
      >
        <GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" img={img} />
        <h3 className="ml-3">{channel.meta.title}</h3>
        {(brief?.count ?? 0) > 0 ? (
          <div
            className="ml-auto h-2 w-2 rounded-full bg-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
            aria-label="Has New Messages"
          />
        ) : null}
      </NavLink>
    </li>
  );
}

function DMSidebarItem({ whom, brief, pending }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const hideNav = useNavStore((state) => state.setLocationHidden);

  return (
    <li className="group relative flex items-center justify-between rounded-lg text-gray-600">
      <NavLink
        to={`/dm/${whom}`}
        className="default-focus flex flex-1 items-center rounded-lg p-2 text-lg sm:text-base"
        onClick={() => isMobile && hideNav()}
      >
        {pending ? (
          <UnknownAvatarIcon className="h-12 w-12 rounded-md text-blue sm:h-6 sm:w-6" />
        ) : (
          <Avatar size={isMobile ? 'default' : 'xs'} ship={whom} />
        )}
        <ShipName className="ml-2 font-semibold" name={whom} showAlias />
        {(brief?.count ?? 0) > 0 || pending ? (
          <div
            className="ml-auto h-2 w-2 rounded-full bg-blue transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
            aria-label="Has New Messages"
          />
        ) : null}
      </NavLink>
      <DmOptions
        ship={whom}
        className="group-two absolute right-0 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      />
    </li>
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
