import React, { useMemo } from 'react';
import bigInt from 'big-integer';
import { useLocation, useNavigate } from 'react-router';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
// eslint-disable-next-line import/no-cycle
import HeapBlock from '@/heap/HeapBlock';
// eslint-disable-next-line import/no-cycle
import HeapContent from '@/heap/HeapContent';
import { useChannelPreview, useGang } from '@/state/groups';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { inlineToString } from '@/logic/tiptap';
import { useRemoteNote } from '@/state/channel/channel';
import {
  imageUrlFromContent,
  linkUrlFromContent,
  VerseInline,
} from '@/types/channel';
import ShapesIcon from '@/components/icons/ShapesIcon';
import ShipName from '@/components/ShipName';
import getHeapContentType from '@/logic/useHeapContentType';
import ReferenceBar from './ReferenceBar';
import ReferenceInHeap from './ReferenceInHeap';

function CurioReference({
  nest,
  idCurio,
  idQuip,
  isScrolling = false,
  contextApp,
  children,
}: {
  nest: string;
  idCurio: string;
  idQuip?: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const reference = useRemoteNote(nest, idCurio, isScrolling, idQuip);
  const preview = useChannelPreview(nest, isScrolling);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateByApp = useNavigateByApp();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const content = useMemo(() => {
    if (reference && 'note' in reference && 'essay' in reference.note) {
      return reference.note.essay.content;
    }
    return [];
  }, [reference]);
  const author = useMemo(() => {
    if (reference && 'note' in reference && 'essay' in reference.note) {
      return reference.note.essay.author;
    }
    return '';
  }, [reference]);
  const note = useMemo(() => {
    if (reference && 'note' in reference) {
      return reference.note;
    }
    return undefined;
  }, [reference]);

  const refToken = preview?.group
    ? `${preview.group.flag}/channels/${nest}/curio/${idCurio}`
    : undefined;

  if (!content || !note) {
    return <HeapLoadingBlock reference />;
  }

  const textFallbackTitle = (
    content.filter((c) => 'inline' in c)[0] as VerseInline
  ).inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { isImage } = getHeapContentType(url);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=curio&nest=${nest}&id=${idCurio}`, {
        state: { backgroundLocation: location },
      });
      return;
    }
    navigateByApp(`/groups/${groupFlag}/channels/${nest}/curio/${idCurio}`);
  };

  if (contextApp === 'heap-row') {
    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={
          isImage ? (
            <img src={url} className="h-[72px] w-[72px] rounded object-cover" />
          ) : (
            <ShapesIcon className="h-6 w-6 text-gray-400" />
          )
        }
        title={textFallbackTitle}
        byline={
          <span>
            Post by <ShipName name={author} showAlias /> in{' '}
            {preview?.meta?.title}
          </span>
        }
      >
        {children}
      </ReferenceInHeap>
    );
  }

  if (contextApp === 'heap-block') {
    if (isImage) {
      return (
        <ReferenceInHeap
          contextApp={contextApp}
          image={
            <img
              src={url}
              loading="lazy"
              className="absolute top-0 left-0 h-full w-full object-cover"
            />
          }
        />
      );
    }

    return (
      <ReferenceInHeap
        type="text"
        contextApp={contextApp}
        image={
          <HeapContent
            className="absolute top-0 left-0 h-full w-full py-4 px-5 leading-6 line-clamp-3"
            content={content}
          />
        }
      />
    );
  }

  return (
    <div className="heap-inline-block not-prose heap-inline-block group">
      <div
        onClick={handleOpenReferenceClick}
        className="flex h-full cursor-pointer flex-col justify-between p-2"
      >
        <HeapBlock note={note} time={idCurio} refToken={refToken} asRef />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(idCurio)}
        author={author}
        groupFlag={preview?.group.flag}
        groupImage={group?.meta.image}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
        heapComment={contextApp === 'heap-comment'}
      />
    </div>
  );
}

export default React.memo(CurioReference);
