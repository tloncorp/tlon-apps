import React, { useMemo } from 'react';
import cn from 'classnames';
import { unixToDa } from '@urbit/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChannelPreview, useGang } from '@/state/groups';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import useGroupJoin from '@/groups/useGroupJoin';
import { useChatState } from '@/state/chat';
import { useChannelFlag } from '@/logic/channel';
import { isImageUrl } from '@/logic/utils';
import { Note } from '@/types/channel';
import ReferenceBar from './ReferenceBar';
import ShipName from '../ShipName';
import ReferenceInHeap from './ReferenceInHeap';
import BubbleIcon from '../icons/BubbleIcon';

interface WritBaseReferenceProps {
  nest: string;
  chFlag: string;
  writ?: Note;
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

  if (!writ.essay.content) {
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
          writ.essay.content.filter((c) => 'block' in c).length > 0 ? (
            <span>Nested content references</span>
          ) : (
            <ChatContent
              className="line-clamp-1"
              story={writ.essay.content}
              isScrolling={false}
            />
          )
        }
        byline={
          <span>
            Chat message by <ShipName name={writ.essay.author} showAlias /> in{' '}
            {preview?.meta?.title}
          </span>
        }
      >
        {children}
      </ReferenceInHeap>
    );
  }

  if (contextApp === 'heap-comment') {
    return (
      <div
        onClick={handleOpenReferenceClick}
        className="cursor-pointer rounded-lg border-2 border-gray-50 text-base"
      >
        <ReferenceInHeap type="text" contextApp={contextApp}>
          <ChatContent
            className="p-2 line-clamp-1"
            story={writ.essay.content}
            isScrolling={false}
          />
          {children}
          <ReferenceBar
            nest={nest}
            time={time}
            author={writ.essay.author}
            groupFlag={preview?.group.flag}
            groupImage={group?.meta.image}
            groupTitle={preview?.group.meta.title}
            channelTitle={preview?.meta?.title}
            heapComment
          />
        </ReferenceInHeap>
      </div>
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
          story={writ.essay.content}
          isScrolling={false}
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        author={writ.essay.author}
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
