import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useQuip, useRemoteOutline } from '@/state/channel/channel';
import { useChannelPreview, useGang } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { ChatStory } from '@/types/chat';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { Inline } from '@/types/content';
import { useChannelFlag } from '@/logic/channel';
import { isCite } from '@/types/channel';
import ReferenceBar from './ReferenceBar';
import ShipName from '../ShipName';
import ReferenceInHeap from './ReferenceInHeap';
import BubbleIcon from '../icons/BubbleIcon';

function NoteCommentReference({
  chFlag,
  nest,
  noteId,
  quipId,
  isScrolling = false,
  contextApp,
  children,
}: {
  chFlag: string;
  nest: string;
  noteId: string;
  quipId: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const preview = useChannelPreview(nest);
  const isReply = useChannelFlag() === chFlag;
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const quip = useQuip(nest, noteId, quipId, isScrolling);
  const navigateByApp = useNavigateByApp();
  const navigate = useNavigate();
  const location = useLocation();
  const outline = useRemoteOutline(nest, noteId, isScrolling);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=note&nest=${nest}&id=${noteId}`, {
        state: { backgroundLocation: location },
      });
      return;
    }

    navigateByApp(`/groups/${groupFlag}/channels/${nest}/note/${noteId}`);
  };

  if (!quip) {
    return <HeapLoadingBlock reference />;
  }

  const normalizedContent: ChatStory = {
    inline: [
      ...quip.memo.content
        .filter((b) => 'inline' in b)
        // @ts-expect-error  we know these are inlines
        .flatMap((b) => b.inline),
    ] as Inline[],
    block: [
      ...quip.memo.content
        .filter((b) => 'block' in b && 'image' in b.block && isCite(b.block))
        // @ts-expect-error  we know these are blocks
        .flatMap((b) => b.block),
    ],
  };

  if (contextApp === 'heap-row') {
    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={<BubbleIcon className="h-6 w-6 text-gray-400" />}
        title={
          <ChatContent
            className="text-lg font-semibold line-clamp-1"
            story={normalizedContent}
            isScrolling={false}
          />
        }
        byline={
          <span className="">
            Comment by <ShipName name={quip.memo.author} showAlias /> on{' '}
            {'diary' in outline['han-data']
              ? outline['han-data'].diary.title
              : null}
          </span>
        }
      >
        {children}
      </ReferenceInHeap>
    );
  }

  if (contextApp === 'heap-block') {
    return (
      <ReferenceInHeap
        type="text"
        contextApp={contextApp}
        image={<ChatContent story={normalizedContent} isScrolling={false} />}
        title={
          <h2 className="mb-2 text-lg font-semibold">
            Comment on{' '}
            {'diary' in outline['han-data']
              ? outline['han-data'].diary.title
              : null}
          </h2>
        }
      >
        {children}
      </ReferenceInHeap>
    );
  }

  return (
    <div className="writ-inline-block not-prose group">
      <div
        onClick={handleOpenReferenceClick}
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent
          className="p-4"
          story={normalizedContent}
          isScrolling={false}
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(udToDec(noteId))}
        author={quip.memo.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
        comment
        reply={isReply}
      />
    </div>
  );
}

export default React.memo(NoteCommentReference);
