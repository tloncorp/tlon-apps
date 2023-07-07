import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import cn from 'classnames';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useRemoteOutline } from '@/state/diary';
import { useChannelPreview, useGang } from '@/state/groups';
import { makePrettyDate, pluralize, truncateProse } from '@/logic/utils';
import bigInt from 'big-integer';
import Avatar from '@/components/Avatar';
import { NOTE_REF_DISPLAY_LIMIT } from '@/constants';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
// eslint-disable-next-line import/no-cycle
import DiaryContent from '@/diary/DiaryContent/DiaryContent';
import ReferenceBar from './ReferenceBar';
import ShipName from '../ShipName';
import Sig16Icon from '../icons/Sig16Icon';

function NoteReference({
  chFlag,
  nest,
  id,
  isScrolling = false,
  contextApp,
  children,
}: {
  chFlag: string;
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
  const outline = useRemoteOutline(chFlag, id, isScrolling);
  const navigateByApp = useNavigateByApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleOpenReferenceClick = () => {
    if (!group) {
      navigate(`/gangs/${groupFlag}?type=note&nest=${nest}&id=${id}`, {
        state: { backgroundLocation: location },
      });
      return;
    }

    navigateByApp(`/groups/${groupFlag}/channels/${nest}/note/${id}`);
  };

  const contentPreview = useMemo(() => {
    if (!outline || !outline.content) {
      return '';
    }

    const truncatedContent = truncateProse(
      outline.content,
      NOTE_REF_DISPLAY_LIMIT
    );

    return <DiaryContent content={truncatedContent} isPreview />;
  }, [outline]);

  if (!outline || !outline.content) {
    return <HeapLoadingBlock reference />;
  }

  const prettyDate = makePrettyDate(new Date(outline.sent));

  if (contextApp === 'heap-row') {
    return (
      <>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded">
          {outline.image ? (
            <img
              src={outline.image}
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
            {outline.title}
          </div>
          <div className="mt-1 flex space-x-2 text-base font-semibold text-gray-400 line-clamp-1">
            <span className="">
              Post by <ShipName name={outline.author} showAlias /> in{' '}
              {preview?.meta?.title}
            </span>
          </div>
          {children}
        </div>
      </>
    );
  }

  if (contextApp === 'heap-block') {
    return (
      <div className={cn('absolute top-0 left-0 h-full w-full px-5 py-4')}>
        <div className="relative z-10 mb-4 text-xl font-semibold line-clamp-1">
          {outline.title}
        </div>
        {contentPreview}
        <div
          className={cn(
            'from-10% via-30% absolute top-0 left-0 h-full w-full bg-gradient-to-t from-white via-transparent'
          )}
        />
      </div>
    );
  }

  return (
    <div className="note-inline-block group max-w-[600px] text-base">
      <div
        onClick={handleOpenReferenceClick}
        className="flex cursor-pointer flex-col space-y-2 p-4 group-hover:bg-gray-50"
      >
        {outline.image ? (
          <div
            className="relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4"
            style={{
              backgroundImage: `url(${outline.image})`,
            }}
          />
        ) : null}
        <span className="text-2xl font-semibold">{outline.title}</span>
        <span className="font-semibold text-gray-400">{prettyDate}</span>
        {outline.quipCount > 0 ? (
          <div className="flex space-x-2">
            <div className="relative flex items-center">
              {outline.quippers.map((author, index) => (
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
              {outline.quipCount} {pluralize('comment', outline.quipCount)}
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
        author={outline.author}
        groupFlag={preview?.group.flag}
        groupImage={group?.meta.image}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}

export default React.memo(NoteReference);
