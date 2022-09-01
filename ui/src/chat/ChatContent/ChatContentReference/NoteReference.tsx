import React, { useEffect } from 'react';
import HeapLoadingBlock from '@/heap/HeapLoadingBlock';
import ReferenceBar from '@/chat/ChatContent/ChatContentReference/ReferenceBar';
import { useDiaryState, useNote } from '@/state/diary';
import { makePrettyDate } from '@/logic/utils';
import { Link } from 'react-router-dom';

export default function NoteReference({
  groupFlag,
  chFlag,
  nest,
  id,
  refToken,
}: {
  groupFlag: string;
  chFlag: string;
  nest: string;
  id: string;
  refToken: string;
}) {
  const noteObject = useNote(chFlag, id);

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
      <ReferenceBar
        groupFlag={groupFlag}
        nest={nest}
        author={note.essay.author}
        time={time}
        top
      />
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
        {/* This just shows the first content item for now */}
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
          to={`/groups/${refToken}`}
          className="small-secondary-button w-20"
        >
          <span className="text-gray-800">Read more</span>
        </Link>
      </div>
      <ReferenceBar groupFlag={groupFlag} nest={nest} time={time} />
    </div>
  );
}
