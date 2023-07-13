import React, { useMemo } from 'react';
import cn from 'classnames';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChannelPreview, useGang } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { ChatWrit } from '@/types/chat';
import useGroupJoin from '@/groups/useGroupJoin';
import { useChatState } from '@/state/chat';
import { unixToDa } from '@urbit/api';
import { useChannelFlag } from '@/logic/channel';
import { isImageUrl } from '@/logic/utils';
import ReferenceBar from './ReferenceBar';
import ShipName from '../ShipName';
import ReferenceInHeap from './ReferenceInHeap';

interface WritBaseReferenceProps {
  nest: string;
  chFlag: string;
  writ?: ChatWrit;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}

function WritBaseReference({
  nest,
  writ,
  chFlag,
  isScrolling,
  contextApp,
  children,
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

  if (contextApp === 'heap-row') {
    return (
      <ReferenceInHeap
        type="text"
        contextApp={contextApp}
        image={
          group && isImageUrl(group.meta.image) ? (
            <img
              src={group.meta.image}
              className="h-[72px] w-[72px] rounded object-cover"
            />
          ) : (
            <div
              className="h-[72px] w-[72px] rounded"
              style={{ background: group?.meta.image }}
            />
          )
        }
        title={
          writ.memo.content.story.block.length > 0 ? (
            <span>Nested content references</span>
          ) : (
            <ChatContent
              className="line-clamp-1"
              story={writ.memo.content.story}
              isScrolling={false}
            />
          )
        }
        byline={
          <span>
            Chat message by <ShipName name={writ.memo.author} showAlias /> in{' '}
            {preview?.meta?.title}
          </span>
        }
      >
        {children}
      </ReferenceInHeap>
    );
  }

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
          className="p-2"
          story={writ.memo.content.story}
          isScrolling={false}
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        author={writ.memo.author}
        groupFlag={preview?.group.flag}
        groupImage={group?.meta.image}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
        reply={isReply}
      />
    </div>
  );
}

export default React.memo(WritBaseReference);
