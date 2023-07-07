import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useQuip, useRemoteOutline } from '@/state/diary';
import { useChannelPreview, useGang } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { ChatBlock, ChatStory } from '@/types/chat';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { useChannelFlag } from '@/logic/channel';
import ReferenceBar from './ReferenceBar';
import Sig16Icon from '../icons/Sig16Icon';
import ShipName from '../ShipName';

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
  const quip = useQuip(chFlag, noteId, quipId, isScrolling);
  const navigateByApp = useNavigateByApp();
  const navigate = useNavigate();
  const location = useLocation();
  const outline = useRemoteOutline(chFlag, noteId, isScrolling);

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
    ...quip.memo.content,
    block: quip.memo.content.block.filter(
      (b) => 'image' in b || 'cite' in b
    ) as ChatBlock[],
  };

  if (contextApp === 'heap-row') {
    return (
      <>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded">
          <div
            style={{ background: group?.meta.image }}
            className="flex h-[72px] w-[72px] items-center justify-center rounded"
          >
            <Sig16Icon className="h-6 w-6 text-black/50" />
          </div>
        </div>
        <div className="flex grow flex-col">
          <ChatContent
            className="text-lg font-semibold line-clamp-1"
            story={normalizedContent}
            isScrolling={false}
          />
          <div className="mt-1 flex space-x-2 text-base font-semibold text-gray-400 line-clamp-1">
            <span className="">
              Comment by <ShipName name={quip.memo.author} showAlias /> on{' '}
              {outline.title}
            </span>
          </div>
          {children}
        </div>
      </>
    );
  }

  if (contextApp === 'heap-block') {
    return (
      <div className="absolute top-0 left-0 h-full w-full px-5 py-4">
        <ChatContent story={normalizedContent} isScrolling={false} />
        <div className="from-10% via-30% absolute top-0 left-0 h-full w-full bg-gradient-to-t from-white via-transparent" />
      </div>
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
