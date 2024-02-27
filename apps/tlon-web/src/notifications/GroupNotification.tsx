import { Rope, Skein, isYarnShip } from '@tloncorp/shared/dist/urbit/hark';

import Avatar from '@/components/Avatar';
import AddIcon16 from '@/components/icons/Add16Icon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import DefaultGroupIcon from '@/components/icons/DefaultGroupIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';
import Person16Icon from '@/components/icons/Person16Icon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import X16Icon from '@/components/icons/X16Icon';
import GroupAvatar from '@/groups/GroupAvatar';
import { useIsMobile } from '@/logic/useMedia';
import { useGang, useGroup, useGroupFlag } from '@/state/groups';

import Notification from './Notification';
import { isDm } from './useNotifications';

interface GroupNotificationProps {
  bin: Skein;
}

interface GroupOrChannelIconProps {
  rope: Rope;
}

const TRUNCATE_LENGTH = 20;

function GroupSubIcon({ rope }: GroupOrChannelIconProps) {
  const channelType = rope?.channel?.split('/')[0];
  const isAdd = rope.thread.endsWith('add');
  const isDel = rope.thread.endsWith('del');
  const isJoin = rope.thread.endsWith('joins');
  const isLeave = rope.thread.endsWith('leaves');
  const isAddRoles = rope.thread.endsWith('add-roles');

  switch (channelType) {
    case 'chat':
      return <ChatSmallIcon className="mr-1 h-4 w-4" />;
    case 'diary':
      return <NotebookIcon className="mr-1 h-4 w-4" />;
    case 'heap':
      return <ShapesIcon className="mr-1 h-4 w-4" />;
    default:
      if (isDm(rope)) {
        return <ChatSmallIcon className="mr-1 h-4 w-4" />;
      }
      if (isAdd) {
        return <AddIcon16 className="mr-1 h-4 w-4" />;
      }
      if (isDel) {
        return <X16Icon className="mr-1 h-4 w-4" />;
      }
      if (isJoin || isAddRoles || isLeave) {
        return <Person16Icon className="mr-1 h-4 w-4" />;
      }
      return <DefaultGroupIcon className="mr-1 h-4 w-4" />;
  }
}

export default function GroupNotification({ bin }: GroupNotificationProps) {
  const isMobile = useIsMobile();
  const rope = bin.top?.rope;
  const group = useGroup(rope?.group || '');
  const groupFlag = useGroupFlag();
  const gang = useGang(rope?.group || '');
  const groupTitle = group?.meta?.title || gang?.preview?.meta.title;
  const channelTitle = group?.channels[rope?.channel || '']?.meta?.title;
  const ship = bin.top?.con.find(isYarnShip);
  const combinedTitle = `${groupTitle || ''}${
    channelTitle ? `: ${channelTitle}` : ''
  }`;
  const truncatedCombinedTitle = `${combinedTitle.slice(
    0,
    TRUNCATE_LENGTH
  )}...`;

  return (
    <Notification
      bin={bin}
      avatar={
        ship ? (
          <Avatar size="default-sm" ship={ship.ship} />
        ) : (
          <GroupAvatar size="w-12 h-12" {...(group || gang?.preview)?.meta} />
        )
      }
      topLine={
        <div className="flex flex-row items-center space-x-1 text-sm font-semibold text-gray-400">
          {!groupFlag && !isDm(rope) ? (
            <GroupAvatar
              image={group?.meta.image || gang.preview?.meta.image}
              title={group?.meta.title || gang.preview?.meta.title}
              size="h-4 w-4"
            />
          ) : (
            <GroupSubIcon rope={rope} />
          )}
          <p>
            {isMobile && combinedTitle.length > TRUNCATE_LENGTH + 1
              ? truncatedCombinedTitle
              : combinedTitle}
          </p>
        </div>
      }
    />
  );
}
