import { imageUrlFromContent } from '@tloncorp/shared/dist/urbit/channel';
import bigInt from 'big-integer';
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import ShipName from '@/components/ShipName';
import ShapesIcon from '@/components/icons/ShapesIcon';
import useGroupJoin from '@/groups/useGroupJoin';
import HeapBlock from '@/heap/HeapBlock';
import HeapContent from '@/heap/HeapContent';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { linkUrlFromContent } from '@/logic/channel';
import { firstInlineSummary } from '@/logic/tiptap';
import getHeapContentType from '@/logic/useHeapContentType';
import { useRemotePost } from '@/state/channel/channel';
import { useChannelPreview, useGang } from '@/state/groups';

import { useNavWithinTab } from '../Sidebar/util';
import ReferenceBar from './ReferenceBar';
import ReferenceInHeap from './ReferenceInHeap';
import UnavailableReference from './UnavailableReference';

function CurioReference({
  nest,
  idCurio,
  idReply,
  isScrolling = false,
  contextApp,
  children,
}: {
  nest: string;
  idCurio: string;
  idReply?: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const { reference, isError } = useRemotePost(
    nest,
    idCurio,
    isScrolling,
    idReply
  );
  const preview = useChannelPreview(nest, isScrolling);
  const { navigate } = useNavWithinTab();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const content = useMemo(() => {
    if (reference && 'post' in reference && 'essay' in reference.post) {
      return reference.post.essay.content;
    }
    return [];
  }, [reference]);
  const author = useMemo(() => {
    if (reference && 'post' in reference && 'essay' in reference.post) {
      return reference.post.essay.author;
    }
    return '';
  }, [reference]);
  const note = useMemo(() => {
    if (reference && 'post' in reference) {
      return reference.post;
    }
    return undefined;
  }, [reference]);

  const refToken = preview?.group
    ? `${preview.group.flag}/channels/${nest}/curio/${idCurio}`
    : undefined;

  if (isError || reference === null) {
    return <UnavailableReference time={bigInt(0)} nest={nest} preview={null} />;
  }

  if (!content || !note) {
    return <HeapLoadingBlock reference />;
  }

  const textFallbackTitle = firstInlineSummary(content);
  const url = linkUrlFromContent(content) || imageUrlFromContent(content) || '';
  const { isImage } = getHeapContentType(url);

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(
        `/gangs/${groupFlag}?type=curio&nest=${nest}&id=${idCurio}`,
        true
      );
      return;
    }
    navigate(`/groups/${groupFlag}/channels/${nest}/curio/${idCurio}`);
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
              className="absolute left-0 top-0 h-full w-full object-cover"
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
            className="absolute left-0 top-0 line-clamp-3 h-full w-full px-5 py-4 leading-6"
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
        <HeapBlock
          post={note}
          citeNest={nest}
          time={idCurio}
          refToken={refToken}
          asRef
        />
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
