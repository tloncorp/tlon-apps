import React, { useCallback } from 'react';
import { useChannel, useGroup } from '@/state/groups';
import Author from '@/chat/ChatMessage/Author';
import { useNavigate } from 'react-router';
import { daToUnix } from '@urbit/api';
import { BigInteger } from 'big-integer';

export default function ReferenceBottomBar({
  groupFlag,
  nest,
  time,
  author,
}: {
  groupFlag: string;
  nest: string;
  time: BigInteger;
  author: string;
}) {
  const navigate = useNavigate();
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);
  const unix = new Date(daToUnix(time));

  const navigateToChannel = useCallback(() => {
    navigate(`/groups/${groupFlag}/channels/${nest}`);
  }, [navigate, nest, groupFlag]);

  return (
    <div className="flex items-center justify-between border-t-2 border-gray-50 p-2 group-hover:bg-gray-50">
      <Author ship={author} date={unix} hideTime />
      <div
        onClick={navigateToChannel}
        className="flex cursor-pointer items-center space-x-2 text-gray-400 group-hover:text-gray-600"
      >
        <span className="font-semibold">{channel?.meta.title}</span>
        <span className="font-bold">•</span>
        <span className="font-semibold">{group?.meta.title}</span>
      </div>
    </div>
  );
}
