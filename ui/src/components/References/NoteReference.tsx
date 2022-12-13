import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { useNavigate } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useDiaryState, useRemoteOutline } from '@/state/diary';
import { useChannelPreview } from '@/state/groups';
import { makePrettyDate, pluralize } from '@/logic/utils';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import Avatar from '@/components/Avatar';
import useAppName from '@/logic/useAppName';
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
  const outline = useRemoteOutline(chFlag, id, isScrolling);
  const navigate = useNavigate();
  const app = useAppName();

  useEffect(() => {
    if (!isScrolling) {
      useDiaryState
        .getState()
        .initialize(chFlag)
        .catch((reason) => {
          console.log(reason);
        });
    }
  }, [chFlag, isScrolling]);

  const handleOpenReferenceClick = () => {
    if (app === 'Talk') {
      const href = `/apps/groups/groups/${groupFlag}/channels/${nest}/note/${id}`;
      window.open(`${window.location.origin}${href}`, '_blank');
    } else {
      navigate(`/groups/${groupFlag}/channels/${nest}/note/${id}`);
    }
  };

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
      <div className="flex flex-col space-y-2 p-2 group-hover:bg-gray-50">
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
        {outline.content.slice(0, 1).map((verse, index) => {
          if ('inline' in verse) {
            return (
              <div key={index}>
                {verse.inline.map((token, i) => {
                  if (typeof token === 'string') {
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
        })}
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
