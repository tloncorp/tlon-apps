import React, { useCallback } from 'react';
import cn from 'classnames';
import Author from '@/chat/ChatMessage/Author';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import ChannelIcon from '@/channels/ChannelIcon';
import GroupAvatar from '@/groups/GroupAvatar';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { useGroup } from '@/state/groups';

interface ReferenceBarProps {
  nest: string;
  time: BigInteger;
  groupFlag?: string;
  groupImage?: string;
  groupTitle?: string;
  channelTitle?: string;
  author?: string;
  top?: boolean;
  comment?: boolean;
  reply?: boolean;
}

export default function ReferenceBar({
  nest,
  time,
  groupFlag,
  groupImage,
  groupTitle,
  channelTitle,
  author,
  top = false,
  comment = false,
  reply = false,
}: ReferenceBarProps) {
  const groupFlagOrZod = groupFlag || '~zod/test';
  const navigateByApp = useNavigateByApp();
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    navigateByApp(`/groups/${groupFlagOrZod}/channels/${nest}`);
  }, [nest, groupFlagOrZod, navigateByApp]);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-gray-50 @container group-hover:bg-gray-50',
        {
          'border-t-2': !top,
          'py-1 px-2': reply,
          'p-2': !reply,
        }
      )}
    >
      {author ? (
        <Author
          className="peer"
          ship={author}
          date={unix}
          hideTime
          isReply={reply}
          isRef
        />
      ) : null}
      {top || reply ? null : (
        <div
          onClick={navigateToChannel}
          className="flex shrink-0 cursor-pointer items-center whitespace-nowrap text-gray-400 group-hover:text-gray-600 peer-hover:hidden @lg:peer-hover:flex"
        >
          <GroupAvatar
            className="mr-1 rounded-sm @lg:order-4"
            size="w-4 h-4"
            image={groupImage}
            title={groupTitle}
          />
          <span className="hidden font-semibold @lg:order-5 @lg:inline">
            {groupTitle}
          </span>
          <span className="hidden text-gray-400 @lg:order-3 @lg:mx-1 @lg:inline">
            &bull;
          </span>
          <ChannelIcon
            nest={nest}
            className="hidden h-4 w-4 @lg:order-1 @lg:mr-1 @lg:block"
          />
          <span className="font-semibold @lg:order-2">{channelTitle}</span>
        </div>
      )}
    </div>
  );
}
