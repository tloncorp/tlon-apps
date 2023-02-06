import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useDiaryState, useRemoteOutline } from '@/state/diary';
import { useChannelPreview, useGang } from '@/state/groups';
import { makePrettyDate, pluralize } from '@/logic/utils';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import Avatar from '@/components/Avatar';
import { NOTE_REF_DISPLAY_LIMIT } from '@/constants';
import useGroupJoin from '@/groups/useGroupJoin';
import useNavigateByApp from '@/logic/useNavigateByApp';
import ReferenceBar from './ReferenceBar';
import UnavailableReference from './UnavailableReference';

export default function NoteReference({
  chFlag,
  nest,
  id,
  isScrolling = false,
}: {
  chFlag: string;
  nest: string;
  id: string;
  isScrolling?: boolean;
}) {
  const preview = useChannelPreview(nest);
  const [scryError, setScryError] = useState<string>();
  const groupFlag = preview?.group?.flag || '~zod/test';
  const gang = useGang(groupFlag);
  const { group } = useGroupJoin(groupFlag, gang);
  const outline = useRemoteOutline(chFlag, id, isScrolling);
  const navigateByApp = useNavigateByApp();
  const navigate = useNavigate();
  const location = useLocation();

  const initialize = useCallback(async () => {
    try {
      await useDiaryState.getState().initialize(chFlag);
    } catch (e) {
      console.log("Couldn't initialize diary state", e);
    }
  }, [chFlag]);

  useEffect(() => {
    if (!isScrolling) {
      initialize();
    }
  }, [chFlag, isScrolling, initialize]);

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
    if (!outline) {
      return '';
    }

    let charCount = 0;
    return outline.content.slice(0, 1).map((verse, index) => {
      if ('inline' in verse) {
        return (
          <div key={index}>
            {verse.inline.map((token, i) => {
              if (charCount > NOTE_REF_DISPLAY_LIMIT) {
                return '';
              }
              if (typeof token === 'string') {
                charCount += token.length;
                return <span key={i}>{token}</span>;
              }
              // TODO: handle other types of tokens
              return '';
            })}
          </div>
        );
      }
      // TODO: handle blocks.
      return '';
    });
  }, [outline]);

  if (scryError !== undefined) {
    // TODO handle requests for single notes like we do for single writs.
    const time = bigInt(udToDec(id));
    return <UnavailableReference time={time} nest={nest} preview={preview} />;
  }

  if (!outline) {
    return <HeapLoadingBlock reference />;
  }

  const prettyDate = makePrettyDate(new Date(outline.sent));

  return (
    <div className="note-inline-block not-prose group">
      <div
        onClick={handleOpenReferenceClick}
        className="flex cursor-pointer flex-col space-y-2 p-2 group-hover:bg-gray-50"
      >
        {outline.image ? (
          <div
            className="relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4"
            style={{
              backgroundImage: `url(${outline.image})`,
            }}
          />
        ) : null}
        <span className="text-2xl font-bold">{outline.title}</span>
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
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
