import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Link } from 'react-router-dom';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import { useDiaryState, useNote } from '@/state/diary';
import { useChannelPreview } from '@/state/groups';
import { makePrettyDate } from '@/logic/utils';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import Avatar from '@/components/Avatar';
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
  const noteObject = useNote(chFlag, id);
  const { quips } = noteObject[1].seal;
  const commentAuthors = _.uniq(
    Array.from(quips).map(([, quip]) => quip.memo.author)
  );
  const totalComments = Array.from(quips).length;

  useEffect(() => {
    if (!isScrolling) {
      useDiaryState
        .getState()
        .initialize(chFlag)
        .catch((reason) => {
          setScryError(reason);
        });
    }
  }, [chFlag, isScrolling]);

  if (scryError !== undefined) {
    // TODO handle requests for single notes like we do for single writs.
    const time = bigInt(udToDec(id));
    return <UnavailableReference time={time} nest={nest} preview={preview} />;
  }

  if (!noteObject) {
    return <HeapLoadingBlock reference />;
  }

  const [time, note] = noteObject;
  const prettyDate = makePrettyDate(new Date(note.essay.sent));

  return (
    <div className="note-inline-block group">
      <div className="flex flex-col space-y-2 p-2 group-hover:bg-gray-50">
        {note.essay.image ? (
          <div
            className="relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4"
            style={{
              backgroundImage: `url(${note.essay.image})`,
            }}
          />
        ) : null}
        <span className="text-2xl font-bold">{note.essay.title}</span>
        <span className="font-semibold text-gray-400">{prettyDate}</span>
        {totalComments > 0 ? (
          <div className="flex space-x-2">
            <div className="relative flex items-center">
              {commentAuthors.map((author, index) => (
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
              {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        ) : null}
        {/*
          TODO: render multiple authors when we have that ability.
          note.essay.author ? <Author ship={note.essay.author} /> : null
        */}
        {note.essay.content.slice(0, 1).map((verse, index) => {
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
        <Link
          to={`/groups/${groupFlag}/channels/${nest}/note/${id}`}
          className="small-secondary-button w-[120px]"
        >
          <span className="text-gray-800">Continue Reading</span>
        </Link>
      </div>
      <ReferenceBar
        nest={nest}
        time={time}
        author={note.essay.author}
        groupFlag={preview?.group.flag}
        groupTitle={preview?.group.meta.title}
        channelTitle={preview?.meta?.title}
      />
    </div>
  );
}
