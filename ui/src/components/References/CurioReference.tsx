import React, { useEffect, useState } from 'react';
import cn from 'classnames';
import { useHeapState, useRemoteCurio } from '@/state/heap/heap';
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
import { isImageUrl } from '@/logic/utils';
import { inlineToString } from '@/logic/tiptap';
import ReferenceBar from './ReferenceBar';
import ShipName from '../ShipName';
import Sig16Icon from '../icons/Sig16Icon';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

function CurioReference({
  chFlag,
  nest,
  idCurio,
  idCurioComment,
  isScrolling = false,
  contextApp,
  children,
}: {
  chFlag: string;
  nest: string;
  idCurio: string;
  idCurioComment?: string;
  isScrolling?: boolean;
  contextApp?: string;
  children?: React.ReactNode;
}) {
  const curio = useRemoteCurio(chFlag, idCurio, isScrolling);
  const curioComment = useRemoteCurio(
    chFlag,
    idCurioComment || '',
    isScrolling
  );
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

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=curio&nest=${nest}&id=${idCurio}`, {
        state: { backgroundLocation: location },
      });
      return;
    }
    navigateByApp(`/groups/${groupFlag}/channels/${nest}/curio/${idCurio}`);
  };

  if (!curio) {
    return <HeapLoadingBlock reference />;
  }

  if (contextApp === 'heap-block') {
    const href = inlineToString(curio?.heart?.content?.inline[0]);
    if (isImageUrl(href)) {
      return (
        <img
          src={href}
          loading="lazy"
          className="absolute top-0 left-0 h-full w-full object-cover"
        />
      );
    }
    return (
      <HeapContent
        className={cn(
          'absolute top-0 left-0 h-full w-full py-4 px-5 leading-6 line-clamp-3'
        )}
        content={curio?.heart.content}
      />
    );
  }

  if (contextApp === 'heap-row') {
    const href = inlineToString(curio?.heart?.content?.inline[0]);
    const textFallbackTitle = curio?.heart?.content.inline
      .map((inline) => inlineToString(inline))
      .join(' ')
      .toString();
    return (
      <>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded">
          {curio?.heart?.content.inline && isImageUrl(href) ? (
            <img
              src={href}
              loading="lazy"
              className="h-[72px] w-[72px] rounded object-cover"
            />
          ) : (
            <div
              style={{ background: group?.meta.image }}
              className="flex h-[72px] w-[72px] items-center justify-center rounded"
            >
              <Sig16Icon className="h-6 w-6 text-black/50" />
            </div>
          )}
        </div>
        <div className="flex grow flex-col">
          <div className="text-lg font-semibold line-clamp-1">
            {textFallbackTitle}
          </div>
          <div className="mt-1 flex space-x-2 text-base font-semibold text-gray-400 line-clamp-1">
            <span className="">
              Post by <ShipName name={curio?.heart.author} showAlias /> in{' '}
              {preview?.meta?.title}
            </span>
          </div>
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      className={cn('heap-inline-block not-prose group', {
        'heap-inline-block': !idCurioComment,
        'writ-inline-block': !!idCurioComment,
      })}
    >
      <div
        onClick={handleOpenReferenceClick}
        className={cn(
          'flex h-full cursor-pointer flex-col justify-between',
          idCurioComment ? 'p-6' : 'p-2'
        )}
      >
        <HeapBlock
          curio={curioComment || curio}
          time={idCurioComment || idCurio}
          isComment={!!idCurioComment}
          refToken={refToken}
          asRef
        />
      </div>
      <ReferenceBar
        nest={nest}
        time={bigInt(idCurio)}
        author={curio.heart.author}
        groupFlag={preview?.group.flag}
        groupImage={group?.meta.image}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}

export default React.memo(CurioReference);
