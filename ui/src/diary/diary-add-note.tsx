import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import _ from 'lodash';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import Layout from '@/components/Layout/Layout';
import { diaryMixedToJSON, JSONToInlines } from '@/logic/tiptap';
import { useDiaryState, useNote } from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { DiaryBlock, NoteContent, NoteEssay } from '@/types/diary';
import { Inline } from '@/types/content';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import PencilIcon from '@/components/icons/PencilIcon';
import { useIsMobile } from '@/logic/useMedia';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

export default function DiaryAddNote() {
  const { chShip, chName, id } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const group = useRouteGroup();
  const isMobile = useIsMobile();
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await useDiaryState.getState().fetchNote(chFlag, id!);
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
        <header
          className={cn(
            'flex items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4'
          )}
        >
          <Link
            to={!editor?.getText() ? `../..` : `../../note/${id}`}
            className={cn(
              'default-focus ellipsis -ml-2 -mt-2 -mb-2 inline-flex appearance-none items-center rounded-md p-2 pr-4 text-lg font-bold text-gray-800 hover:bg-gray-50 sm:text-base sm:font-semibold',
              isMobile && ''
            )}
            aria-label="Exit Editor"
          >
            <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />

            <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 p-1 text-center">
              <PencilIcon className="h-3 w-3 text-gray-400" />
            </div>
            <span className="ellipsis line-clamp-1">Editing</span>
          </Link>

          <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
            {isMobile && <ReconnectingSpinner />}
            <button
              disabled={!editor?.getText() || status === 'loading'}
              className={cn(
                'small-button bg-blue text-white disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:text-gray-400'
              )}
              onClick={publish}
            >
              {status === 'loading' ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : status === 'error' ? (
                'Error'
              ) : (
                'Save'
              )}
            </button>
          </div>
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
