import React, { useCallback, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import _ from 'lodash';
import { unixToDa } from '@urbit/api';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import Layout from '@/components/Layout/Layout';
import { mixedToJSON, JSONMixedToInlines } from '@/logic/tiptap';
import { useDiaryState, useNote } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { DiaryBlock, NoteContent, NoteEssay } from '@/types/diary';
import { Inline } from '@/types/content';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

export default function DiaryAddNote() {
  const { chShip, chName, id } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const group = useRouteGroup();
  const navigate = useNavigate();
  const [, note] = useNote(chFlag, id || '');
  const content = useMemo(
    () =>
      note.essay.content.length > 0 ? mixedToJSON(note.essay.content) : '',
    [note.essay.content]
  );

  const form = useForm<Pick<NoteEssay, 'title' | 'image'>>({
    defaultValues: {
      title: note.essay.title || '',
      image: note.essay.image || '',
    },
  });

  const { reset, register, getValues } = form;

  const editor = useDiaryInlineEditor({
    content,
    placeholder: '',
    onEnter: () => false,
  });

  const publish = useCallback(() => {
    if (!editor?.getText()) {
      return;
    }

    const data = JSONMixedToInlines(editor?.getJSON());
    const values = getValues();

    const sent = Date.now();

    const isBlock = (c: Inline | DiaryBlock) =>
      ['image', 'cite'].some((k) => typeof c !== 'string' && k in c);
    const noteContent: NoteContent = [];
    let index = 0;
    data.forEach((c, i) => {
      if (i < index) {
        return;
      }

      if (isBlock(c)) {
        noteContent.push({ block: c as DiaryBlock });
        index += 1;
      } else {
        const inline = _.takeWhile(
          _.drop(data, index),
          (d) => !isBlock(d)
        ) as Inline[];
        noteContent.push({ inline });
        index += inline.length;
      }
    });

    if (id) {
      useDiaryState.getState().editNote(chFlag, id, {
        ...note.essay,
        ...values,
        content: noteContent,
      });
    } else {
      useDiaryState.getState().addNote(chFlag, {
        ...values,
        content: noteContent,
        author: window.our,
        sent,
      });
    }

    reset();
    if (!editor?.isDestroyed) {
      editor.commands.setContent('');
    }
    navigate(
      `/groups/${group}/channels/diary/${chFlag}?new=${unixToDa(
        sent
      ).toString()}`
    );
  }, [chFlag, editor, id, note.essay, reset, getValues, navigate, group]);

  return (
    <Layout
      className="align-center w-full flex-1 bg-white"
      mainClass="overflow-y-auto"
      header={
        <header className="flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-4">
          <Link
            to="../.."
            className="flex h-8 w-8 items-center justify-center rounded bg-gray-50"
            aria-label="Back to notebook"
          >
            <CaretLeftIcon className="h-6 w-6 text-gray-600" />
          </Link>
          <button
            disabled={!editor?.getText()}
            className={cn(
              'button bg-blue text-white disabled:bg-gray-200 disabled:text-gray-400 dark:text-black dark:disabled:text-gray-400'
            )}
            onClick={publish}
          >
            Publish
          </button>
        </header>
      }
    >
      <FormProvider {...form}>
        <div className="mx-auto max-w-xl p-4">
          <form className="space-y-6">
            <CoverImageInput url="" />
            <input
              placeholder="New Title"
              className="input-transparent text-3xl font-semibold"
              type="text"
              {...register('title')}
            />
          </form>
          <div className="py-6">
            {editor ? <DiaryInlineEditor editor={editor} /> : null}
          </div>
        </div>
      </FormProvider>
    </Layout>
  );
}
