import React, { useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import { unixToDa } from '@urbit/api';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import Layout from '@/components/Layout/Layout';
import { JSONToInlines } from '@/logic/tiptap';
import { useDiaryState } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { NoteEssay } from '@/types/diary';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

export default function DiaryAddNote() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const group = useRouteGroup();
  const navigate = useNavigate();

  const form = useForm<Pick<NoteEssay, 'title' | 'image'>>({
    defaultValues: {
      title: '',
      image: '',
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

    const data = JSONToInlines(editor?.getJSON());
    const values = getValues();

    const sent = Date.now();

    useDiaryState.getState().addNote(chFlag, {
      ...values,
      content: [{ inline: Array.isArray(data) ? data : [data] }],
      author: window.our,
      sent,
    });

    reset();
    if (!editor?.isDestroyed) {
      editor.commands.setContent('');
    }
    navigate(
      `/groups/${group}/channels/diary/${chFlag}?new=${unixToDa(
        sent
      ).toString()}`
    );
  }, [chFlag, editor, reset, getValues, navigate, group]);

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
              'button bg-blue text-white disabled:bg-gray-200 disabled:text-gray-400 dark:text-black'
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
