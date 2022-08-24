import ChannelHeader from '@/channels/ChannelHeader';
import Layout from '@/components/Layout/Layout';
import { useDiaryState, useNote, useQuips } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';

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

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  return (
    <Layout
      className="flex-1 bg-white"
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      <div className="flex flex-col space-y-4">
        <div>
          <h4>Content</h4>
          {JSON.stringify(note.essay, null, 2)}
        </div>
        <div>
          <h4>Comments</h4>
          <ul>
            {Array.from(quips).map(([time, quip]) => (
              <li key={time.toString()}>{JSON.stringify(quip, null, 2)}</li>
            ))}
          </ul>
        </div>

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
      </div>
    </Layout>
  );
}
