import _ from 'lodash';
import React, { useCallback, useEffect } from 'react';
import { Outlet, useParams, useRoutes } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup, useVessel } from '@/state/groups/groups';
import { useNotesForDiary, useDiaryPerms, useDiaryState } from '@/state/diary';
import ChannelHeader from '@/channels/ChannelHeader';
import { nestToFlag } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import { parseInline, parseTipTapJSON, tipTapToString } from '@/logic/tiptap';
import { VerseInline } from '@/types/diary';
import { Link } from 'react-router-dom';
import useDismissChannelNotifications from '@/logic/useDismissChannelNotifications';
import DiaryEditor, { useDiaryEditor } from './DiaryEditor';

interface NoteForm {
  title: string;
  image: string;
}

function DiaryChannel() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();

  const notes = useNotesForDiary(chFlag);
  const perms = useDiaryPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { register, handleSubmit, reset } = useForm<NoteForm>({
    defaultValues: {
      title: '',
      image: '',
    },
  });
  const editor = useDiaryEditor({
    content: '',
    placeholder: 'Write a note...',
  });

  const onSubmit = useCallback(
    ({ title, image }: NoteForm) => {
      if (!editor?.getText()) {
        return;
      }

      const data = parseTipTapJSON(editor?.getJSON());

      useDiaryState.getState().addNote(chFlag, {
        title,
        image,
        content: [{ inline: Array.isArray(data) ? data : [data] }],
        author: window.our,
        sent: Date.now(),
      });

      reset();
    },
    [chFlag, editor, reset]
  );

  useEffect(() => {
    useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  useDismissChannelNotifications({
    markRead: useDiaryState.getState().markRead,
  });

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      <div className="p-4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="text" {...register('title')} placeholder="Enter title" />
          <input
            type="text"
            {...register('image')}
            placeholder="Enter image URL"
          />
          {editor ? <DiaryEditor editor={editor} /> : null}
          <button type="submit" className="button">
            publish
          </button>
        </form>
        <ul>
          {Array.from(notes)
            .sort(([a], [b]) => b.compare(a))
            .map(([time, note]) => (
              <Link to={`note/${time.toString()}`}>
                <li key={time.toString()}>
                  <span>{note.essay.title}</span>
                  <p>
                    {tipTapToString(
                      parseInline((note.essay.content[0] as VerseInline).inline)
                    )}
                  </p>
                </li>
              </Link>
            ))}
        </ul>
      </div>
    </Layout>
  );
}

export default DiaryChannel;
