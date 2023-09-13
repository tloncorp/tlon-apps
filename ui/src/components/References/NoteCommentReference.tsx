import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useQuip, useRemoteNote } from '@/state/channel/channel';
import { useChannelPreview, useGang } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { useChannelFlag } from '@/logic/channel';
import getHanDataFromEssay from '@/logic/getHanData';
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
  const note = useRemoteNote(nest, noteId, isScrolling);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=note&nest=${nest}&id=${noteId}`, {
        state: { backgroundLocation: location },
      });
      return;
    }

    navigateByApp(`/groups/${groupFlag}/channels/${nest}/note/${noteId}`);
  };

  if (!quip || !note) {
    return <HeapLoadingBlock reference />;
  }

  const { title } = getHanDataFromEssay(note?.essay);

  if (contextApp === 'heap-row') {
    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={<BubbleIcon className="h-6 w-6 text-gray-400" />}
        title={
          <ChatContent
            className="text-lg font-semibold line-clamp-1"
            story={quip.memo.content}
            isScrolling={false}
          />
        }
        byline={
          <span className="">
            Comment by <ShipName name={quip.memo.author} showAlias /> on {title}
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
        image={<ChatContent story={quip.memo.content} isScrolling={false} />}
        title={
          <h2 className="mb-2 text-lg font-semibold">Comment on {title}</h2>
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
          story={quip.memo.content}
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
