import cn from 'classnames';
import React, { ReactNode, useCallback } from 'react';
import ob from 'urbit-ob';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import ShipName from '@/components/ShipName';
import { makePrettyTime, pluralize, PUNCTUATION_REGEX } from '@/logic/utils';
import useHarkState from '@/state/hark';
import { YarnContent } from '@/types/hark';
import { Bin, isComment, isMention } from './useNotifications';

interface NotificationProps {
  bin: Bin;
  topLine?: ReactNode;
  avatar?: ReactNode;
}

function getContent(content: YarnContent, key: string) {
  if (typeof content === 'string') {
    // this feels pretty grug
    if (content === ' mentioned you :') return ': ';
    return (
      <span key={key}>
        {content.split(' ').map((s, i) =>
          ob.isValidPatp(s.replaceAll(PUNCTUATION_REGEX, '')) ? (
            <span
              key={`${s}-${i}`}
              className="mr-1 inline-block rounded bg-blue-soft px-1.5 py-0 text-blue mix-blend-multiply"
            >
              <ShipName name={s.replaceAll(PUNCTUATION_REGEX, '')} />
            </span>
          ) : (
            <span key={`${s}-${i}`}>{s} </span>
          )
        )}
      </span>
    );
  }

  if ('ship' in content) {
    return (
      <ShipName
        key={key}
        name={content.ship}
        className="font-semibold text-gray-800"
      />
    );
  }

  return (
    <strong key={key} className="text-gray-800">
      {content.emph}
    </strong>
  );
}

export default function Notification({
  bin,
  avatar,
  topLine,
}: NotificationProps) {
  const rope = bin.topYarn?.rope;
  const moreCount = bin.count - 1;
  const mention = isMention(bin.topYarn);
  const comment = isComment(bin.topYarn);

  const onClick = useCallback(() => {
    useHarkState.getState().sawRope(rope);
  }, [rope]);

  return (
    <div
      className={cn(
        'relative flex space-x-3 rounded-xl p-3 text-gray-600',
        bin.unread ? 'bg-blue-soft dark:bg-blue-900' : 'bg-white'
      )}
    >
      <Link
        to={bin.topYarn?.wer || ''}
        className="flex w-full min-w-0 flex-1 space-x-3"
        onClick={onClick}
      >
        <div className="relative flex-none self-start">{avatar}</div>
        <div className="min-w-0 grow-0 break-words p-1">
          {topLine}
          <p className="my-2 leading-5">
            {bin.topYarn &&
              bin.topYarn.con.map((con, i) =>
                getContent(
                  con,
                  // we can have multiple identical content items, so we need to
                  // use the index as a key
                  `${bin.topYarn.id}-${i}`
                )
              )}
          </p>
          {moreCount > 0 ? (
            <p className="my-2 text-sm font-semibold">
              Latest of {moreCount} new messages.
            </p>
          ) : (
            <div className="my-2" />
          )}
          {mention || comment ? (
            <p className="small-button mt-0 bg-gray-50 text-gray-800">Reply</p>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-5 flex-none p-1">
        {bin.unread ? (
          <Dropdown.Root>
            <Dropdown.Trigger className="flex items-center space-x-1 text-sm">
              {bin.unread ? (
                <Bullet16Icon className="h-4 w-4 text-blue" />
              ) : null}
              <span className="font-semibold">
                {makePrettyTime(new Date(bin.time))}
              </span>
              <CaretDown16Icon className="h-4 w-4 text-gray-400" />
            </Dropdown.Trigger>
            <Dropdown.Content className="dropdown">
              <Dropdown.Item className="dropdown-item" onSelect={onClick}>
                Mark Read
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        ) : null}
      </div>
    </div>
  );
}
