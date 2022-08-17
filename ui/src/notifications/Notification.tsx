import ShipName from '@/components/ShipName';
import { pluralize } from '@/logic/utils';
import { useGroup } from '@/state/groups';
import useHarkState from '@/state/hark';
import { YarnContent } from '@/types/hark';
import cn from 'classnames';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
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

  const onClick = useCallback(() => {
    useHarkState.getState().sawRope(rope);
  }, [rope]);

  return (
    <div
      className={cn(
        'flex items-center rounded-xl p-3 text-gray-600',
        bin.unread ? 'bg-blue-soft dark:bg-blue-900' : 'bg-gray-50'
      )}
    >
      <Link
        to={bin.topYarn?.wer || ''}
        className="flex items-center space-x-1"
        onClick={onClick}
      >
        <div />
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
      <div />
    </div>
  );
}
