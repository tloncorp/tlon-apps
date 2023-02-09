import React, { useCallback } from 'react';
import cn from 'classnames';
import Author from '@/chat/ChatMessage/Author';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import ChannelIcon from '@/channels/ChannelIcon';
import useNavigateByApp from '@/logic/useNavigateByApp';

export default function ReferenceBar({
  nest,
  time,
  groupFlag,
  groupTitle,
  channelTitle,
  author,
  top = false,
  comment = false,
}: {
  nest: string;
  time: BigInteger;
  groupFlag?: string;
  groupTitle?: string;
  channelTitle?: string;
  author?: string;
  top?: boolean;
  comment?: boolean;
}) {
  const groupFlagOrZod = groupFlag || '~zod/test';
  const navigateByApp = useNavigateByApp();
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    navigateByApp(`/groups/${groupFlagOrZod}/channels/${nest}`);
  }, [nest, groupFlagOrZod, navigateByApp]);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-gray-50 p-2 group-hover:bg-gray-50',
        {
          'border-t-2': !top,
        }
      )}
    >
      {author ? <Author ship={author} date={unix} hideTime /> : null}
      {top ? null : (
        <div
          onClick={navigateToChannel}
          className="flex cursor-pointer items-center space-x-2 text-gray-400 group-hover:text-gray-600"
        >
          {comment ? (
            <span className="pt-0.5 text-sm text-gray-400">Comment in:</span>
          ) : null}
          <ChannelIcon nest={nest} className="-mr-1 h-4 w-4" />
          <span className="font-semibold">{channelTitle}</span>
          {groupTitle ? (
            <>
              <span className="font-bold">•</span>
              <span className="font-semibold">{groupTitle}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
