import React, { useCallback } from 'react';
import { useWrit } from '@/state/chat';
import { useNavigate } from 'react-router';
import { useChannel, useGroup } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { daToUnix } from '@urbit/api';
import Author from '@/chat/ChatMessage/Author';

export default function WritReference({
  groupFlag,
  chFlag,
  nest,
  idWrit,
  refToken,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  idWrit: string;
  refToken: string;
}) {
  const writObject = useWrit(chFlag, idWrit);
  const navigate = useNavigate();
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);

  const openThreadForWrit = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  const navigateToChannel = useCallback(() => {
    navigate(`/groups/${groupFlag}/channels/${nest}`);
  }, [navigate, nest, groupFlag]);

  if (!writObject) {
    return (
      <div className="writ-inline-block p-2">
        This is a reference to a group you do not have access to.
      </div>
    );
  }

  const [time, writ] = writObject;
  const {
    memo: { author, content },
  } = writ;

  const unix = new Date(daToUnix(time));

  if (!('story' in content)) {
    return null;
  }

  return (
    <div className="writ-inline-block group">
      <div
        onClick={openThreadForWrit}
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent story={content.story} />
      </div>
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
    </div>
  );
}
