import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import _ from 'lodash';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import Layout from '@/components/Layout/Layout';
import { diaryMixedToJSON, JSONToInlines } from '@/logic/tiptap';
import { useDiaryState, useNote } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { DiaryBlock, NoteContent, NoteEssay } from '@/types/diary';
import { Inline } from '@/types/content';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

export default function DiaryAddNote() {
  const { chShip, chName, id } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const group = useRouteGroup();
  const navigate = useNavigate();
  const [idNote, note] = useNote(chFlag, id || '');
  const [status, setStatus] = useState<Status>('initial');
  const content = useMemo(
    () =>
      note.essay.content.length > 0 ? diaryMixedToJSON(note.essay.content) : '',
    [note.essay.content]
  );

  const loading = idNote.isZero();

  useEffect(() => {
    async function load() {
      await useDiaryState.getState().initialize(chFlag);
      if (loading) {
        useDiaryState.getState().fetchNote(chFlag, id!);
      }
    }

    load();
  }, [chFlag, id, loading]);

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

  const publish = useCallback(async () => {
    if (!editor?.getText()) {
      return;
    }

    setStatus('loading');

    const data = JSONToInlines(editor?.getJSON(), false, true);
    const values = getValues();

    const sent = Date.now();

    const isBlock = (c: Inline | DiaryBlock) =>
      ['image', 'cite', 'listing', 'header', 'rule', 'code'].some(
        (k) => typeof c !== 'string' && k in c
      );
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

    let returnTime = id;
    try {
      if (id) {
        await useDiaryState.getState().editNote(chFlag, id, {
          ...note.essay,
          ...values,
          content: noteContent,
        });
      } else {
        returnTime = await useDiaryState.getState().addNote(chFlag, {
          ...values,
          content: noteContent,
          author: window.our,
          sent,
        });
      }

      setStatus('success');
      reset();
      if (!editor?.isDestroyed) {
        editor.commands.setContent('');
      }
      navigate(`/groups/${group}/channels/diary/${chFlag}?new=${returnTime}`);
    } catch (error) {
      setStatus('error');
    }
  }, [chFlag, editor, getValues, group, id, navigate, note.essay, reset]);

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
            disabled={!editor?.getText() || status === 'loading'}
            className={cn(
              'button bg-blue text-white disabled:bg-gray-200 disabled:text-gray-400 dark:text-black dark:disabled:text-gray-400'
            )}
            onClick={publish}
          >
            {status === 'loading' ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Publishing
              </>
            ) : status === 'error' ? (
              'Error'
            ) : (
              'Publish'
            )}
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
