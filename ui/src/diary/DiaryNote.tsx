import ChannelHeader from '@/channels/ChannelHeader';
import Avatar from '@/components/Avatar';
import Bubble16Icon from '@/components/icons/Bubble16Icon';
import BubbleIcon from '@/components/icons/BubbleIcon';
import Layout from '@/components/Layout/Layout';
import ShipName from '@/components/ShipName';
import { pluralize } from '@/logic/utils';
import { useDiaryState, useNote, useQuips } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { format } from 'date-fns';
import _ from 'lodash';
import f from 'lodash/fp';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import DiaryContent from './DiaryContent/DiaryContent';
import DiaryNoteHeader from './DiaryNoteHeader';

interface CommentForm {
  content: string;
}

export default function DiaryNote() {
  const { chShip, chName, noteId = '' } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();

  const [, note] = useNote(chFlag, noteId)!;

  const { register, handleSubmit, reset } = useForm<CommentForm>({
    defaultValues: {
      content: '',
    },
  });
  const onSubmit = (values: CommentForm) => {
    console.log(values);
    console.log('noteid', noteId);
    useDiaryState.getState().addQuip(chFlag, noteId, [values.content]);
  };

  const quips = useQuips(chFlag, noteId);

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
      <section className="mx-auto flex max-w-[600px] flex-col space-y-12">
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
          <h4>Comments</h4>
          <ul>
            {Array.from(quips).map(([time, quip]) => (
              <li key={time.toString()}>{JSON.stringify(quip, null, 2)}</li>
            ))}
          </ul>
          <div className="p-4">
            <form onSubmit={handleSubmit(onSubmit)}>
              <input
                type="text"
                {...register('content')}
                placeholder="Your 2 cents"
              />
              <button type="submit" className="button">
                comment
              </button>
            </form>
          </div>
        </footer>
      </section>
    </Layout>
  );
}
