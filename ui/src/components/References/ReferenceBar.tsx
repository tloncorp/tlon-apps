import React, { useCallback } from 'react';
import cn from 'classnames';
import Author from '@/chat/ChatMessage/Author';
import { useNavigate } from 'react-router';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';
import ChannelIcon from '@/channels/ChannelIcon';
import { nestToFlag } from '@/logic/utils';
import useAppName from '@/logic/useAppName';

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
  const [nestApp] = nestToFlag(nest);
  const app = useAppName();

  const navigate = useNavigate();
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    if (unSubbed) {
      // TODO: hook this up to the Join Channel Modal
      console.log('join channel modal');
    } else if (app === 'Talk' && (nestApp === 'diary' || nestApp === 'heap')) {
      const href = `/apps/groups/groups/${groupFlagOrZod}/channels/${nest}`;
      window.open(`${window.location.origin}${href}`, '_blank');
    } else {
      navigate(`/groups/${groupFlagOrZod}/channels/${nest}`);
    }
  }, [navigate, nest, groupFlagOrZod, unSubbed, app, nestApp]);

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
