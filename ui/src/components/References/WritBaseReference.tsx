import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChannelPreview, useGang } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { ChatWrit } from '@/types/chat';
import useGroupJoin from '@/groups/useGroupJoin';
import ReferenceBar from './ReferenceBar';

export default function WritBaseReference({
  nest,
  writ,
}: {
  nest: string;
  writ?: ChatWrit;
}) {
  const preview = useChannelPreview(nest);
  const location = useLocation();
  const navigate = useNavigate();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);

  // TODO: handle failure for useWritByFlagAndWritId call.
  if (!writ) {
    return <HeapLoadingBlock reference />;
  }

  const time = bigInt(udToDec(writ.seal.id.split('/')[1]));

  if (!('story' in writ.memo.content)) {
    return null;
  }

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=chat&nest=${nest}&id=${time}`, {
        state: { backgroundLocation: location },
      });
      return;
    }
    navigate(`/groups/${groupFlag}/channels/${nest}?msg=${time}`);
  };

  return (
    <div className="writ-inline-block not-prose group">
      <div
        onClick={handleOpenReferenceClick}
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent story={writ.memo.content.story} isScrolling={false} />
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        author={writ.memo.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
