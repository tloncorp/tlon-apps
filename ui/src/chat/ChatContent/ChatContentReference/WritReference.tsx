import React, { useCallback, useEffect } from 'react';
import { useWrit, useChatState } from '@/state/chat';
import { useNavigate } from 'react-router';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ReferenceBar from '@/chat/ChatContent/ChatContentReference/ReferenceBar';

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

  useEffect(() => {
    useChatState.getState().initialize(chFlag);
  }, [chFlag]);

  const openThreadForWrit = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  if (!writObject) {
    return <LoadingSpinner />;
  }

  const [time, writ] = writObject;
  const {
    memo: { author, content },
  } = writ;

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
      <ReferenceBar
        groupFlag={groupFlag}
        nest={nest}
        time={time}
        author={author}
      />
    </div>
  );
}
