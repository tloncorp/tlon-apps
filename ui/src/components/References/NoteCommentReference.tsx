import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useDiaryState, useQuip } from '@/state/diary';
import { useChannelPreview, useGang } from '@/state/groups';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { ChatBlock, ChatStory } from '@/types/chat';
// eslint-disable-next-line import/no-cycle
import ChatContent from '@/chat/ChatContent/ChatContent';
import { useChannelFlag } from '@/hooks';
import ReferenceBar from './ReferenceBar';
import UnavailableReference from './UnavailableReference';

export default function NoteCommentReference({
  chFlag,
  nest,
  noteId,
  quipId,
  isScrolling = false,
}: {
  chFlag: string;
  nest: string;
  noteId: string;
  quipId: string;
  isScrolling?: boolean;
}) {
  const preview = useChannelPreview(nest);
  const isReply = useChannelFlag() === chFlag;
  const [scryError, setScryError] = useState<string>();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const quip = useQuip(chFlag, noteId, quipId);
  const navigateByApp = useNavigateByApp();
  const navigate = useNavigate();
  const location = useLocation();

  const initialize = useCallback(async () => {
    try {
      await useDiaryState.getState().initialize(chFlag);
      await useDiaryState.getState().fetchNote(chFlag, noteId);
    } catch (e) {
      console.log("Couldn't initialize diary state", e);
    }
  }, [chFlag, noteId]);

  useEffect(() => {
    if (!isScrolling) {
      initialize();
    }
  }, [chFlag, isScrolling, initialize]);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=note&nest=${nest}&id=${noteId}`, {
        state: { backgroundLocation: location },
      });
      return;
    }

    navigateByApp(`/groups/${groupFlag}/channels/${nest}/note/${noteId}`);
  };

  if (scryError !== undefined) {
    // TODO handle requests for single notes like we do for single writs.
    const time = bigInt(udToDec(noteId));
    return <UnavailableReference time={time} nest={nest} preview={preview} />;
  }

  if (!quip) {
    return <HeapLoadingBlock reference />;
  }

  const normalizedContent: ChatStory = {
    ...quip.memo.content,
    block: quip.memo.content.block.filter(
      (b) => 'image' in b || 'cite' in b
    ) as ChatBlock[],
  };

  return (
    <div className="writ-inline-block not-prose group">
      <div
        onClick={handleOpenReferenceClick}
        className="cursor-pointer p-2 group-hover:bg-gray-50"
      >
        <ChatContent story={normalizedContent} isScrolling={false} />
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
