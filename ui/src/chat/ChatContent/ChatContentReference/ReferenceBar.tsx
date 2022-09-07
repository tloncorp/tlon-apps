import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { useChannel, useGroup, useGroupPreviewByNest } from '@/state/groups';
import Author from '@/chat/ChatMessage/Author';
import { useNavigate } from 'react-router';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import ChannelIcon from '@/channels/ChannelIcon';
import { useEffectOnce } from 'usehooks-ts';

export default function ReferenceBar({
  nest,
  time,
  author,
  top = false,
}: {
  nest: string;
  time: BigInteger;
  author?: string;
  top?: boolean;
}) {
  const preview = useGroupPreviewByNest(nest);
  const groupFlag = preview?.group?.flag || '~zod/test';

  const navigate = useNavigate();
  const channel = preview?.meta;
  const group = useGroup(groupFlag);
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    navigate(`/groups/${groupFlag}/channels/${nest}`);
  }, [navigate, nest, groupFlag]);

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
          <span className="font-semibold">{channel?.title}</span>
          <span className="font-bold">•</span>
          <span className="font-semibold">{preview?.group?.meta.title}</span>
        </div>
      )}
    </div>
  );
}
