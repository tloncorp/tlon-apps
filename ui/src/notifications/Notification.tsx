import cn from 'classnames';
import React, { ReactNode, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import ShipName from '@/components/ShipName';
import { makePrettyTime, pluralize } from '@/logic/utils';
import useHarkState from '@/state/hark';
import { YarnContent } from '@/types/hark';
import { Bin } from './useNotifications';

interface NotificationProps {
  bin: Bin;
  topLine?: ReactNode;
  avatar?: ReactNode;
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

export default function Notification({
  bin,
  avatar,
  topLine,
}: NotificationProps) {
  const rope = bin.topYarn?.rope;
  const moreCount = bin.count - 1;

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
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">{avatar}</div>
        <div className="min-w-0 grow-0 space-y-2 break-words p-1">
          {topLine}
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
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
    </div>
  );
}
