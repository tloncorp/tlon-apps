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

interface MessagesSidebarItemProps {
  whom: string;
  brief: ChatBrief;
  pending?: boolean; // eslint-disable-line
}

function ChannelSidebarItem({ whom, brief }: MessagesSidebarItemProps) {
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
      >
        {(img || '').length > 0 ? (
          <img
            className="h-6 w-6 rounded border-2 border-transparent"
            src={img}
          />
        ) : (
          <div className="h-6 w-6 rounded border-2 border-gray-100" />
        )}
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
  return (
    <li className="group relative flex items-center justify-between rounded-lg text-gray-600">
      <NavLink
        to={`/dm/${whom}`}
        className="default-focus flex flex-1 items-center rounded-lg p-2"
      >
        {pending ? (
          <UnknownAvatarIcon className="h-6 text-blue" />
        ) : (
          <Avatar size="xs" ship={whom} />
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
