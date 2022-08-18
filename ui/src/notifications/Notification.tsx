import cn from 'classnames';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import ShipName from '@/components/ShipName';
import Avatar from '@/components/Avatar';
import { makePrettyTime, pluralize } from '@/logic/utils';
import { useGroup } from '@/state/groups';
import useHarkState from '@/state/hark';
import { isYarnShip, YarnContent } from '@/types/hark';
import GroupAvatar from '@/groups/GroupAvatar';
import { Bin } from './useNotifications';

interface NotificationProps {
  bin: Bin;
}

function getContent(content: YarnContent) {
  if (typeof content === 'string') {
    return <span>{content}</span>;
  }

  if ('ship' in content) {
    return (
      <ShipName name={content.ship} className="font-semibold text-gray-800" />
    );
  }

  return <strong className="text-gray-800">{content.emph}</strong>;
}

export default function Notification({ bin }: NotificationProps) {
  const rope = bin.topYarn?.rope;
  const group = useGroup(rope?.group || '');
  const groupTitle = group?.meta.title;
  const channelTitle = group?.channels[rope?.channel || '']?.meta.title;
  const moreCount = bin.count - 1;
  const ship = bin.topYarn?.con.find(isYarnShip);

  const onClick = useCallback(() => {
    useHarkState.getState().sawRope(rope);
  }, [rope]);

  return (
    <div
      className={cn(
        'flex space-x-3 rounded-xl p-3 text-gray-600',
        bin.unread ? 'bg-blue-soft dark:bg-blue-900' : 'bg-gray-50'
      )}
    >
      <Link
        to={bin.topYarn?.wer || ''}
        className="flex flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">
          <GroupAvatar size="w-12 h-12" {...group?.meta} />
          {ship ? (
            <div className="absolute -bottom-2 -right-2">
              <Avatar size="xs" ship={ship.ship} />
            </div>
          ) : null}
        </div>
        <div className="space-y-2 p-1">
          <p className="text-sm font-semibold">
            {groupTitle}
            {': '}
            {channelTitle}
          </p>
          <p>{bin.topYarn && bin.topYarn.con.map(getContent)}</p>
          {moreCount > 0 ? (
            <p className="text-sm font-semibold">
              {moreCount} more {pluralize('message', moreCount)} from{' '}
              {bin.shipCount > 1 ? `${bin.shipCount} people` : '1 person'}
            </p>
          ) : (
            <p className="text-sm">&nbsp;</p>
          )}
        </div>
      </Link>
      <div className="flex-none p-1">
        <Dropdown.Root>
          <Dropdown.Trigger className="flex items-center space-x-1 text-sm">
            {bin.unread ? <Bullet16Icon className="h-4 w-4 text-blue" /> : null}
            <span className="font-semibold">
              {makePrettyTime(new Date(bin.time))}
            </span>
            <CaretDown16Icon className="h-4 w-4 text-gray-400" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown">
            {bin.unread ? (
              <Dropdown.Item className="dropdown-item" onSelect={onClick}>
                Mark Read
              </Dropdown.Item>
            ) : null}
            {/* TODO add settings */}
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
    </div>
  );
}
