import React from 'react';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
// eslint-disable-next-line import/no-cycle
import HeapBlock from '@/heap/HeapBlock';
// eslint-disable-next-line import/no-cycle
import HeapContent from '@/heap/HeapContent';
import { useChannelPreview, useGang } from '@/state/groups';
import bigInt from 'big-integer';
import useGroupJoin from '@/groups/useGroupJoin';
import { useLocation, useNavigate } from 'react-router';
import useNavigateByApp from '@/logic/useNavigateByApp';
import { inlineToString } from '@/logic/tiptap';
import { useRemoteOutline } from '@/state/channel/channel';
import {
  imageUrlFromContent,
  linkUrlFromContent,
  VerseInline,
} from '@/types/channel';
import ShapesIcon from '@/components/icons/ShapesIcon';
import ShipName from '@/components/ShipName';
import useHeapContentType from '@/logic/useHeapContentType';
import ReferenceBar from './ReferenceBar';
import ReferenceInHeap from './ReferenceInHeap';

function CurioReference({
  nest,
  idCurio,
  isScrolling = false,
  contextApp,
  children,
}: {
  nest: string;
  idCurio: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const outline = useRemoteOutline(nest, idCurio, isScrolling);
  const preview = useChannelPreview(nest, isScrolling);
  const location = useLocation();
  const navigate = useNavigate();
  const navigateByApp = useNavigateByApp();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const refToken = preview?.group
    ? `${preview.group.flag}/channels/${nest}/curio/${idCurio}`
    : undefined;
  const { content } = outline;
  const textFallbackTitle = (
    content.filter((c) => 'inline' in c)[0] as VerseInline
  ).inline
    .map((inline) => inlineToString(inline))
    .join(' ')
    .toString();
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { isImage } = useHeapContentType(url);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=curio&nest=${nest}&id=${idCurio}`, {
        state: { backgroundLocation: location },
      });
      return;
    }
    navigateByApp(`/groups/${groupFlag}/channels/${nest}/curio/${idCurio}`);
  };

  if (!outline) {
    return <HeapLoadingBlock reference />;
  }

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
            Post by <ShipName name={outline.author} showAlias /> in{' '}
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
            content={outline.content}
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
        <HeapBlock outline={outline} time={idCurio} refToken={refToken} asRef />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(idCurio)}
        author={outline.author}
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
