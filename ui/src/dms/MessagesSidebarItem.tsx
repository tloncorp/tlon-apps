import React from 'react';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';
import DmOptions from './DMOptions';
import UnknownAvatarIcon from '../components/icons/UnknownAvatarIcon';
import { useMultiDm } from '../state/chat';
import { useChannel, useGroup, useGroupState } from '../state/groups/groups';
import { useIsMobile } from '../logic/useMedia';
import GroupAvatar from '../groups/GroupAvatar';
import SidebarItem from '../components/Sidebar/SidebarItem';
import MultiDmAvatar from './MultiDmAvatar';
import { whomIsDm, whomIsMultiDm } from '../logic/utils';
import { useMessagesScrolling } from './MessagesScrollingContext';

interface MessagesSidebarItemProps {
  whom: string;
  pending?: boolean; // eslint-disable-line
}

function ChannelSidebarItem({ whom, pending }: MessagesSidebarItemProps) {
  const groups = useGroupState((s) => s.groups);
  const nest = `chat/${whom}`;
  const groupFlag = Object.entries(groups).find(
    ([k, v]) => nest in v.channels
  )?.[0];
  const channel = useChannel(groupFlag || '', nest);
  const group = useGroup(groupFlag || '');
  const isScrolling = useMessagesScrolling();

  if (!channel) {
    return null;
  }

  return (
    <SidebarItem
      to={`/groups/${groupFlag}/channels/${nest}`}
      icon={
        <GroupAvatar
          size="h-12 w-12 sm:h-6 sm:w-6"
          {...group?.meta}
          loadImage={!isScrolling}
        />
      }
      actions={<DmOptions whom={whom} pending={!!pending} />}
    >
      {channel.meta.title}
    </SidebarItem>
  );
}

function DMSidebarItem({ whom, pending }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const isScrolling = useMessagesScrolling();

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        <Avatar
          size={isMobile ? 'default' : 'xs'}
          ship={whom}
          loadImage={!isScrolling}
        />
      }
      actions={<DmOptions whom={whom} pending={!!pending} />}
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
  pending,
}: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const club = useMultiDm(whom);
  const allMembers = club?.team.concat(club.hive);
  const groupName = club?.meta.title || allMembers?.join(', ') || whom;
  const isScrolling = useMessagesScrolling();

  if (club && !allMembers?.includes(window.our)) {
    return null;
  }

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        pending ? (
          <UnknownAvatarIcon className="h-12 w-12 rounded-md text-blue md:h-6 md:w-6" />
        ) : (
          <MultiDmAvatar
            {...club?.meta}
            title={groupName}
            size={isMobile ? 'default' : 'xs'}
            loadImage={!isScrolling}
          />
        )
      }
      actions={<DmOptions whom={whom} pending={!!pending} isMulti />}
    >
      {groupName}
    </SidebarItem>
  );
}

function MessagesSidebarItem({ whom, pending }: MessagesSidebarItemProps) {
  if (whomIsDm(whom)) {
    return <DMSidebarItem pending={pending} whom={whom} />;
  }

  if (whomIsMultiDm(whom)) {
    return <MultiDMSidebarItem whom={whom} pending={pending} />;
  }

  return <ChannelSidebarItem whom={whom} pending={pending} />;
}

export default React.memo(MessagesSidebarItem);
