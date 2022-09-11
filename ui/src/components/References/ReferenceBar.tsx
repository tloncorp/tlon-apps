import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { useChannel, useGroup, useGroupPreviewByNest } from '@/state/groups';
import Author from '@/chat/ChatMessage/Author';
import { useNavigate } from 'react-router';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import ChannelIcon from '@/channels/ChannelIcon';

export default function ReferenceBar({
  nest,
  time,
  groupFlag,
  groupTitle,
  channelTitle,
  author,
  top = false,
  unSubbed = false,
}: {
  nest: string;
  time: BigInteger;
  groupFlag?: string;
  groupTitle?: string;
  channelTitle?: string;
  author?: string;
  top?: boolean;
  unSubbed?: boolean;
}) {
  const groupFlagOrZod = groupFlag || '~zod/test';

  const navigate = useNavigate();
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    if (unSubbed) {
      console.log('join channel modal');
    } else {
      navigate(`/groups/${groupFlagOrZod}/channels/${nest}`);
    }
  }, [navigate, nest, groupFlagOrZod, unSubbed]);

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
          <ChannelIcon nest={nest} className="-mr-1 h-4 w-4" />
          <span className="font-semibold">{channelTitle}</span>
          <span className="font-bold">•</span>
          <span className="font-semibold">{groupTitle}</span>
        </div>
      )}
    </div>
  );
}
