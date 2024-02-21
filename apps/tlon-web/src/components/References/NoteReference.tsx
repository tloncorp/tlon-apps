import bigInt from 'big-integer';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Avatar from '@/components/Avatar';
import { NOTE_REF_DISPLAY_LIMIT } from '@/constants';
// eslint-disable-next-line import/no-cycle
import DiaryContent from '@/diary/DiaryContent/DiaryContent';
import useGroupJoin from '@/groups/useGroupJoin';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import getKindDataFromEssay from '@/logic/getKindData';
import {
  isImageUrl,
  makePrettyDate,
  pluralize,
  truncateProse,
} from '@/logic/utils';
import { useRemotePost } from '@/state/channel/channel';
import { useChannelPreview, useGang } from '@/state/groups';

import ShipName from '../ShipName';
import NotebookIcon from '../icons/NotebookIcon';
import ReferenceBar from './ReferenceBar';
import ReferenceInHeap from './ReferenceInHeap';
import UnavailableReference from './UnavailableReference';

function NoteReference({
  nest,
  id,
  isScrolling = false,
  contextApp,
  children,
}: {
  nest: string;
  id: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const preview = useChannelPreview(nest, isScrolling);
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const { reference, isError } = useRemotePost(nest, id, isScrolling);
  const navigate = useNavigate();
  const location = useLocation();
  const note = useMemo(() => {
    if (reference && 'post' in reference) {
      return reference.post;
    }
    return undefined;
  }, [reference]);

  const contentPreview = useMemo(() => {
    if (!note || !note.essay?.content) {
      return '';
    }

    const truncatedContent = truncateProse(
      note.essay.content,
      NOTE_REF_DISPLAY_LIMIT
    );

    return <DiaryContent content={truncatedContent} isPreview />;
  }, [note]);

  if (isError || reference === null) {
    return <UnavailableReference nest={nest} time={bigInt(0)} preview={null} />;
  }

  if (!note || !note.essay?.content) {
    return <HeapLoadingBlock reference />;
  }

  const { title, image } = getKindDataFromEssay(note.essay);
  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=note&nest=${nest}&id=${id}`, {
        state: { backgroundLocation: location },
      });
      return;
    }

    navigate(`/groups/${groupFlag}/channels/${nest}/note/${id}`);
  };

  const prettyDate = makePrettyDate(new Date(note.essay.sent));

  if (contextApp === 'heap-row') {
    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={
          isImageUrl(image) ? (
            <img
              src={image}
              className="h-[72px] w-[72px] rounded object-cover"
            />
          ) : (
            <NotebookIcon className="h-6 w-6 text-gray-400" />
          )
        }
        title={title}
        byline={
          <span>
            Note by <ShipName name={note.essay.author} showAlias /> in{' '}
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
        <ReferenceInHeap
          contextApp={contextApp}
          image={
            isImageUrl(image) ? (
              <img
                src={image}
                className="h-[72px] w-[72px] rounded object-cover"
              />
            ) : (
              <NotebookIcon className="h-6 w-6 text-gray-400" />
            )
          }
          title={title}
        >
          {children}
          <ReferenceBar
            nest={nest}
            time={bigInt(id)}
            author={note.essay.author}
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

  if (contextApp === 'heap-block') {
    return (
      <ReferenceInHeap
        type="text"
        title={<h2 className="mb-2 text-lg font-semibold">{title}</h2>}
        contextApp={contextApp}
        image={contentPreview}
      />
    );
  }

  return (
    <div className="note-inline-block group max-w-[600px] text-base">
      <div
        onClick={handleOpenReferenceClick}
        className="flex cursor-pointer flex-col space-y-2 p-4 group-hover:bg-gray-50"
      >
        {image ? (
          <div
            className="relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4"
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
        ) : null}
        <span className="text-2xl font-semibold">{title}</span>
        <span className="font-semibold text-gray-400">{prettyDate}</span>
        {note.seal.meta.replyCount > 0 ? (
          <div className="flex space-x-2">
            <div className="relative flex items-center">
              {note.seal.meta.lastRepliers.map((author, index) => (
                <Avatar
                  ship={author}
                  size="xs"
                  className="relative outline outline-2 outline-white"
                  style={{
                    zIndex: 2 - index,
                    transform: `translate(${index * -50}%)`,
                  }}
                />
              ))}
            </div>
            <span className="font-semibold text-gray-600">
              {note.seal.meta.replyCount}{' '}
              {pluralize('comment', note.seal.meta.replyCount)}
            </span>
          </div>
        ) : null}
        {/*
          TODO: render multiple authors when we have that ability.
          note.essay.author ? <Author ship={note.essay.author} /> : null
        */}
        {contentPreview}
        <button
          onClick={handleOpenReferenceClick}
          className="small-secondary-button w-[120px]"
        >
          <span className="text-gray-800">Continue Reading</span>
        </button>
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(id)}
        author={note.essay.author}
        groupFlag={preview?.group.flag}
        groupImage={group?.meta.image}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}

export default React.memo(NoteReference);
