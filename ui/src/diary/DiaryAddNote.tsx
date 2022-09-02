import CoverImageInput from '@/components/CoverImageInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import Layout from '@/components/Layout/Layout';
import { parseTipTapJSON } from '@/logic/tiptap';
import { useDiaryState } from '@/state/diary';
import { NoteEssay } from '@/types/diary';
import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

export default function DiaryAddNote() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;

  const form = useForm<Pick<NoteEssay, 'title' | 'image'>>({
    defaultValues: {
      title: '',
      image: 'https://0x0.st/oT-r.jpg',
    },
  });

  const { reset, register, getValues } = form;

  const editor = useDiaryInlineEditor({
    content: '',
    placeholder: '',
    onEnter: () => false,
  });

  const publish = useCallback(() => {
    if (!editor?.getText()) {
      return;
    }

    const data = parseTipTapJSON(editor?.getJSON());
    const values = getValues();

    useDiaryState.getState().addNote(chFlag, {
      ...values,
      content: [{ inline: Array.isArray(data) ? data : [data] }],
      author: window.our,
      sent: Date.now(),
    });

    reset();
    if (!editor?.isDestroyed) {
      editor.commands.setContent('');
    }
  }, [chFlag, editor, reset, getValues]);

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
            className="button bg-blue text-white dark:text-black"
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
              className="input-transparent text-3xl"
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
