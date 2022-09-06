import React, { useEffect } from 'react';
import _ from 'lodash';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import ReferenceBar from '@/chat/ChatContent/ChatContentReference/ReferenceBar';
import { useDiaryState, useNote, useQuips } from '@/state/diary';
import { makePrettyDate } from '@/logic/utils';
import { Link } from 'react-router-dom';
import Author from '@/chat/ChatMessage/Author';
import Avatar from '@/components/Avatar';

export default function NoteReference({
  groupFlag,
  chFlag,
  nest,
  id,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  id: string;
}) {
  const noteObject = useNote(chFlag, id);
  const quips = useQuips(chFlag, id);
  const commentAuthors = _.uniq(
    Array.from(quips).map(([, quip]) => quip.memo.author)
  );
  const totalComments = Array.from(quips).length;

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

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
        groupFlag={groupFlag}
        nest={nest}
        author={note.essay.author}
        time={time}
      />
    </div>
  );
}
