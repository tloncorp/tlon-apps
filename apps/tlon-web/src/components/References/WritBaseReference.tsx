import bigInt from 'big-integer';
import cn from 'classnames';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import useGroupJoin from '@/groups/useGroupJoin';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useChannelFlag } from '@/logic/channel';
import { isImageUrl, nestToFlag } from '@/logic/utils';
import { useChannelPreview, useGang } from '@/state/groups';
import { ReferenceResponse } from '@/types/channel';

import ShipName from '../ShipName';
import ReferenceBar from './ReferenceBar';
import ReferenceInHeap from './ReferenceInHeap';

interface WritBaseReferenceProps {
  nest: string;
  reference?: ReferenceResponse;
  isScrolling: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}

function WritBaseReference({
  nest,
  reference,
  isScrolling,
  contextApp,
  children,
}: WritBaseReferenceProps) {
  const preview = useChannelPreview(nest, isScrolling);
  const location = useLocation();
  const navigate = useNavigate();
  const [app, chFlag] = nestToFlag(nest);
  const refMessageType = useMemo(() => {
    if (app === 'chat') {
      return 'message';
    }
    if (app === 'heap') {
      return 'curio';
    }
    return 'note';
  }, [app]);
  const isReply = useChannelFlag() === chFlag;
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const content = useMemo(() => {
    if (reference && 'post' in reference && 'essay' in reference.post) {
      return reference.post.essay.content;
    }
    if (reference && 'reply' in reference && 'memo' in reference.reply.reply) {
      return reference.reply.reply.memo.content;
    }
    return [];
  }, [reference]);
  const author = useMemo(() => {
    if (reference && 'post' in reference && 'essay' in reference.post) {
      return reference.post.essay.author;
    }
    if (reference && 'reply' in reference && 'memo' in reference.reply.reply) {
      return reference.reply.reply.memo.author;
    }
    return '';
  }, [reference]);
  const noteId = useMemo(() => {
    if (reference && 'post' in reference) {
      return reference.post.seal.id;
    }
    if (reference && 'reply' in reference) {
      return reference.reply['id-post'];
    }
    return '';
  }, [reference]);

  // TODO: handle failure for useWritByFlagAndWritId call.
  if (!reference) {
    return <HeapLoadingBlock reference />;
  }

  if (content.length === 0) {
    return null;
  }

  const handleOpenReferenceClick = () => {
    // We have nowhere to navigate to if we haven't yet loaded group information
    if (!preview?.group?.flag) {
      return;
    }
    if (!group) {
      if ('post' in reference) {
        navigate(
          `/gangs/${groupFlag}?type=chat&nest=${nest}&id=${reference.post.seal.id}`,
          {
            state: { backgroundLocation: location },
          }
        );
      } else {
        navigate(
          `/gangs/${groupFlag}?type=chat&nest=${nest}&id=${reference.reply['id-post']}`,
          {
            state: { backgroundLocation: location },
          }
        );
      }
      return;
    }
    if ('post' in reference) {
      navigate(
        `/groups/${groupFlag}/channels/${nest}?msg=${reference.post.seal.id}`
      );
    } else {
      navigate(
        `/groups/${groupFlag}/channels/${nest}/${refMessageType}/${reference.reply['id-post']}`
      );
    }
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
          content.filter((c) => 'block' in c).length > 0 ? (
            <span>Nested content references</span>
          ) : (
            <ChatContent
              className="line-clamp-1"
              story={content}
              isScrolling={false}
            />
          )
        }
        byline={
          <span>
            Chat message by <ShipName name={author} showAlias /> in{' '}
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
      <div className="cursor-pointer rounded-lg border-2 border-gray-50 text-base">
        <ReferenceInHeap type="text" contextApp={contextApp}>
          <ChatContent
            className="line-clamp-1 p-2"
            story={content}
            isScrolling={false}
            onClick={handleOpenReferenceClick}
          />
          {children}
          <ReferenceBar
            nest={nest}
            time={bigInt(noteId)}
            author={author}
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
      <div className={'cursor-pointer p-2 group-hover:bg-gray-50'}>
        <ChatContent
          className="p-2"
          story={content}
          isScrolling={false}
          onClick={handleOpenReferenceClick}
          writId={noteId}
          isInReference
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(noteId)}
        author={author}
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
