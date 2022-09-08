import React, { useEffect } from 'react';
import { useWrit, useChatState } from '@/state/chat';
import { Link } from 'react-router-dom';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ReferenceBar from '@/chat/ChatContent/ChatContentReference/ReferenceBar';

export default function WritReference({
  groupFlag,
  chFlag,
  nest,
  idWrit,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  idWrit: string;
}) {
  const writObject = useWrit(chFlag, idWrit);

  useEffect(() => {
    useChatState.getState().initialize(chFlag);
  }, [chFlag]);

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
      <Link
        to={`/groups/${groupFlag}/channels/${nest}?msg=${time}`}
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent story={content.story} />
      </Link>
      <ReferenceBar nest={nest} time={time} author={author} />
    </div>
  );
}
