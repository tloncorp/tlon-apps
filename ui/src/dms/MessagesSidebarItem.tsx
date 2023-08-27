import React, { useEffect, useState } from 'react';
import useLongPress from '@/logic/useLongPress';
import Avatar, { AvatarSizes } from '../components/Avatar';
import ShipName from '../components/ShipName';
import DmOptions from './DMOptions';
import { useMultiDm } from '../state/chat';
import { useChannel, useGroup, useGroups } from '../state/groups/groups';
import useMedia, { useIsMobile } from '../logic/useMedia';
import GroupAvatar from '../groups/GroupAvatar';
import SidebarItem from '../components/Sidebar/SidebarItem';
import MultiDmAvatar, { MultiDmAvatarSize } from './MultiDmAvatar';
import { whomIsDm, whomIsMultiDm } from '../logic/utils';
import { useMessagesScrolling } from './MessagesScrollingContext';

interface MessagesSidebarItemProps {
  whom: string;
  pending?: boolean; // eslint-disable-line
}

interface MessagesSidebarItemWithOptionsProps extends MessagesSidebarItemProps {
  optionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
}

function ChannelSidebarItem({
  whom,
  pending,
  optionsOpen,
  onOptionsOpenChange,
  ...props
}: MessagesSidebarItemWithOptionsProps) {
  const groups = useGroups();
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
          size="h-12 w-12 sm:h-6 sm:w-6 rounded-lg sm:rounded"
          {...group?.meta}
          loadImage={!isScrolling}
        />
      }
      actions={({ hover }) => (
        <DmOptions
          open={optionsOpen}
          onOpenChange={onOptionsOpenChange}
          whom={whom}
          pending={!!pending}
          isHovered={hover}
        />
      )}
      {...props}
    >
      {channel.meta.title}
    </SidebarItem>
  );
}

function DMSidebarItem({
  whom,
  pending,
  optionsOpen,
  onOptionsOpenChange,
  ...props
}: MessagesSidebarItemWithOptionsProps) {
  const isMobile = useIsMobile();
  const isScrolling = useMessagesScrolling();
  const isSmall = useMedia('(max-width: 768px) and (min-width: 640px)');

  function avatarSize(): { size: AvatarSizes; icon: boolean } {
    if (isMobile && !isSmall) {
      return {
        size: 'default',
        icon: false,
      };
    }
    return {
      size: 'xs',
      icon: true,
    };
  }

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        <Avatar
          className="h-12 w-12 rounded-lg sm:h-6 sm:w-6 sm:rounded"
          ship={whom}
          loadImage={!isScrolling}
          {...avatarSize()}
        />
      }
      actions={({ hover }) => (
        <DmOptions
          open={optionsOpen}
          onOpenChange={onOptionsOpenChange}
          whom={whom}
          pending={!!pending}
          isHovered={hover}
        />
      )}
      {...props}
    >
      <ShipName className="truncate" name={whom} showAlias />
    </SidebarItem>
  );
}

export function MultiDMSidebarItem({
  whom,
  pending,
  optionsOpen,
  onOptionsOpenChange,
  ...props
}: MessagesSidebarItemWithOptionsProps) {
  const isMobile = useIsMobile();
  const club = useMultiDm(whom);
  const allMembers = club?.team.concat(club.hive);
  const groupName = club?.meta.title || allMembers?.join(', ') || whom;
  const isScrolling = useMessagesScrolling();
  const isSmall = useMedia('(max-width: 768px) and (min-width: 640px)');

  function avatarSize(): { size: MultiDmAvatarSize } {
    if (isMobile && !isSmall) {
      return {
        size: 'default',
      };
    }
    return {
      size: 'xs',
    };
  }

  if (club && !allMembers?.includes(window.our)) {
    return null;
  }

  return (
    <SidebarItem
      to={`/dm/${whom}`}
      icon={
        <MultiDmAvatar
          {...club?.meta}
          title={groupName}
          className="h-12 w-12 rounded-lg sm:h-6 sm:w-6 sm:rounded"
          loadImage={!isScrolling}
          {...avatarSize()}
        />
      }
      actions={({ hover }) => (
        <DmOptions
          open={optionsOpen}
          onOpenChange={onOptionsOpenChange}
          whom={whom}
          pending={!!pending}
          isHovered={hover}
        />
      )}
      {...props}
    >
      {groupName}
    </SidebarItem>
  );
}

function MessagesSidebarItem({ whom, pending }: MessagesSidebarItemProps) {
  const isMobile = useIsMobile();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (action === 'longpress') {
      setOptionsOpen(true);
    }
  }, [action, isMobile]);

  let ResolvedSidebarItem = ChannelSidebarItem;

  if (whomIsDm(whom)) {
    ResolvedSidebarItem = DMSidebarItem;
  }

  if (whomIsMultiDm(whom)) {
    ResolvedSidebarItem = MultiDMSidebarItem;
  }

  return (
    <ResolvedSidebarItem
      whom={whom}
      pending={pending}
      optionsOpen={optionsOpen}
      onOptionsOpenChange={setOptionsOpen}
      {...handlers}
    />
  );
}

export default React.memo(MessagesSidebarItem);
