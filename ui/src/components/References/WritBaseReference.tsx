import React, { useMemo } from 'react';
import cn from 'classnames';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChannelPreview, useGang } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import bigInt from 'big-integer';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { ChatWrit } from '@/types/chat';
import useGroupJoin from '@/groups/useGroupJoin';
import { useChannelFlag } from '@/hooks';
import { useChatState } from '@/state/chat';
import { unixToDa } from '@urbit/api';
import ReferenceBar from './ReferenceBar';

interface WritBaseReferenceProps {
  nest: string;
  chFlag: string;
  writ?: ChatWrit;
  isScrolling: boolean;
}

export default function WritBaseReference({
  nest,
  writ,
  chFlag,
  isScrolling,
}: WritBaseReferenceProps) {
  const isReply = useChannelFlag() === chFlag;
  const preview = useChannelPreview(nest, isScrolling);
  const location = useLocation();
  const navigate = useNavigate();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const time = useMemo(
    () =>
      writ
        ? useChatState.getState().getTime(chFlag, writ.seal.id)
        : unixToDa(Date.now()),
    [chFlag, writ]
  );

  // TODO: handle failure for useWritByFlagAndWritId call.
  if (!writ) {
    return <HeapLoadingBlock reference />;
  }

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
    <div
      className={cn('writ-inline-block not-prose group', {
        'mb-2': isReply,
      })}
    >
      <div
        onClick={handleOpenReferenceClick}
        className={'cursor-pointer p-2 group-hover:bg-gray-50'}
      >
        <ChatContent
          className="p-4"
          story={writ.memo.content.story}
          isScrolling={false}
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        author={writ.memo.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
        reply={isReply}
      />
    </div>
  );
}
