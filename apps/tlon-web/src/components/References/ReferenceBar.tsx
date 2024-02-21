import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import cn from 'classnames';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';

import ChannelIcon from '@/channels/ChannelIcon';
import Author from '@/chat/ChatMessage/Author';
import GroupAvatar from '@/groups/GroupAvatar';

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
  heapComment?: boolean;
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
  heapComment = false,
  reply = false,
}: ReferenceBarProps) {
  const navigate = useNavigate();
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    if (!groupFlag) return;
    navigate(`/groups/${groupFlag}/channels/${nest}`);
  }, [nest, groupFlag, navigate]);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-gray-50 group-hover:bg-gray-50',
        {
          'border-t-2': !top,
          'px-2 py-1': reply,
          'p-2': !reply,
        }
      )}
    >
      {author && !heapComment ? (
        <Author
          className="peer"
          ship={author}
          date={unix}
          hideRoles
          hideTime
          isReply={reply}
          isRef
        />
      ) : null}
      {author && heapComment ? (
        <div className="flex flex-col space-y-2">
          <Author
            className="peer !py-0"
            ship={author}
            hideRoles
            isReply={reply}
            isRef
          />
          <div
            onClick={navigateToChannel}
            className="flex shrink-0 cursor-pointer items-center whitespace-nowrap text-gray-400 group-hover:text-gray-600 peer-hover:hidden lg:peer-hover:flex"
          >
            <GroupAvatar
              className="rounded-sm lg:order-5"
              size="w-4 h-4"
              image={groupImage}
              title={groupTitle}
            />
            <span className="ml-2 font-semibold lg:order-6 lg:inline">
              {groupTitle}
            </span>
          </div>
          <div className="flex shrink-0 cursor-pointer items-center whitespace-nowrap text-gray-400 group-hover:text-gray-600 peer-hover:hidden lg:peer-hover:flex">
            <ChannelIcon nest={nest} className="h-4 w-4 lg:order-2 lg:block" />
            <span className="ml-2 font-semibold lg:order-3">
              {channelTitle}
            </span>
          </div>
        </div>
      ) : null}
      {top || reply || heapComment ? null : (
        <div
          onClick={navigateToChannel}
          className="flex shrink-0 cursor-pointer items-center whitespace-nowrap text-gray-400 group-hover:text-gray-600 peer-hover:hidden lg:peer-hover:flex"
        >
          <GroupAvatar
            className="mr-1 rounded-sm lg:order-5"
            size="w-4 h-4"
            image={groupImage}
            title={groupTitle}
          />
          <span className="hidden font-semibold lg:order-6 lg:inline">
            {groupTitle}
          </span>
          <span className="hidden text-gray-400 lg:order-4 lg:mx-1 lg:inline">
            &bull;
          </span>
          {comment ? (
            <span className="mr-1 hidden font-semibold text-gray-400 xl:order-1 xl:inline">
              Comment in:
            </span>
          ) : null}
          <ChannelIcon
            nest={nest}
            className="hidden h-4 w-4 lg:order-2 lg:mr-1 lg:block"
          />
          <span className="font-semibold lg:order-3">{channelTitle}</span>
        </div>
      )}
    </div>
  );
}
