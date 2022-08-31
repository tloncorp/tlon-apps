import Avatar from '@/components/Avatar';
import Divider from '@/components/Divider';
import Bubble16Icon from '@/components/icons/Bubble16Icon';
import Layout from '@/components/Layout/Layout';
import ShipName from '@/components/ShipName';
import { pluralize } from '@/logic/utils';
import { useBrief, useDiaryState, useNote, useQuips } from '@/state/diary';
import { format } from 'date-fns';
import _ from 'lodash';
import f from 'lodash/fp';
import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import DiaryComment from './DiaryComment';
import DiaryCommentField from './DiaryCommentField';
import DiaryContent from './DiaryContent/DiaryContent';
import DiaryNoteHeader from './DiaryNoteHeader';

export default function DiaryNote() {
  const { chShip, chName, noteId = '' } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const [, note] = useNote(chFlag, noteId)!;
  const quips = useQuips(chFlag, noteId);
  const quipArray = Array.from(quips);
  const brief = useBrief(chFlag);

  const commenters = _.flow(
    f.compact,
    f.uniq,
    f.take(3)
  )([...quips].map(([, v]) => v.memo.author));

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  return (
    <Layout
      className="h-full flex-1 overflow-y-scroll bg-white"
      header={<DiaryNoteHeader title={note.essay.title} />}
      mainClass="p-6"
    >
      <section className="mx-auto flex max-w-[600px] flex-col space-y-12 pb-32">
        {note.essay.image && (
          <img
            src={note.essay.image}
            alt=""
            className="h-auto w-full rounded-xl"
          />
        )}
        <header className="space-y-6">
          <h1 className="text-3xl font-semibold">{note.essay.title}</h1>
          <p className="font-semibold text-gray-400">
            {format(note.essay.sent, 'LLLL do, yyyy')}
          </p>
          <a href="#comments" className="flex items-center">
            <div className="flex items-center space-x-2 font-semibold">
              <Avatar ship={note.essay.author} size="xs" />
              <ShipName name={note.essay.author} />
            </div>
            <div className="ml-auto flex items-center">
              <div className="relative flex items-center font-semibold text-gray-600">
                {commenters.length > 0 ? (
                  <>
                    {commenters.map((ship, index) => (
                      <Avatar
                        key={ship}
                        ship={ship}
                        size="xs"
                        className="relative outline outline-2 outline-white"
                        style={{
                          zIndex: 2 - index,
                          transform: `translate(${index * -50}%)`,
                        }}
                      />
                    ))}
                    <span>
                      {quips.size} {pluralize('comment', quips.size)}
                    </span>
                  </>
                ) : (
                  <>
                    <Bubble16Icon className="mr-2 h-4 w-4" />
                    <span className="text-gray-400">No comments</span>
                  </>
                )}
              </div>
            </div>
          </a>
        </header>
        <DiaryContent content={note.essay.content} />
        <footer id="comments">
          <div className="mb-3 flex items-center py-3">
            <Divider className="flex-1">
              <h2 className="font-semibold text-gray-400">
                {quips.size > 0
                  ? `${quips.size} ${pluralize('comment', quips.size)}`
                  : 'No comments'}
              </h2>
            </Divider>
          </div>
          <DiaryCommentField flag={chFlag} replyTo={noteId} />
          <ul className="mt-12">
            {quipArray.map(([time, quip], index) => {
              const prev = index > 0 ? quipArray[index - 1] : undefined;

              return (
                <li key={time.toString()}>
                  <DiaryComment
                    time={time}
                    quip={quip}
                    brief={brief}
                    prevQuip={prev?.[1]}
                    prevQuipTime={prev?.[0]}
                  />
                </li>
              );
            })}
          </ul>
        </footer>
      </section>
    </Layout>
  );
}
