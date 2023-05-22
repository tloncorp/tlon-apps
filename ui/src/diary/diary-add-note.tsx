import React, { useCallback, useMemo, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import _ from 'lodash';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import Layout from '@/components/Layout/Layout';
import { diaryMixedToJSON, JSONToInlines } from '@/logic/tiptap';
import {
  useAddNoteMutation,
  useEditNoteMutation,
  useNote,
} from '@/state/diary';
import { useRouteGroup } from '@/state/groups';
import { DiaryBlock, NoteContent, NoteEssay } from '@/types/diary';
import { Inline } from '@/types/content';
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
  const {
    note,
    isLoading: loadingNote,
    fetchStatus,
  } = useNote(chFlag, id || '0', id === undefined ? true : false);
  const { mutateAsync: editNote, status: editStatus } = useEditNoteMutation();
  const {
    data: returnTime,
    mutateAsync: addNote,
    status: addStatus,
  } = useAddNoteMutation();
  const content = useMemo(
    () => (note && !loadingNote ? diaryMixedToJSON(note.essay.content) : ''),
    [note, loadingNote]
  );

  const form = useForm<Pick<NoteEssay, 'title' | 'image'>>({
    defaultValues: {
      title: note?.essay?.title || '',
      image: note?.essay?.image || '',
    },
  });

  const { reset, register, getValues, setValue } = form;

  useEffect(() => {
    const { title, image } = getValues();
    if (!loadingNote && title === '' && image === '' && note?.essay) {
      setValue('title', note.essay.title);
      setValue('image', note.essay.image);
    }
  }, [note, setValue, loadingNote, getValues]);

  const editor = useDiaryInlineEditor({
    content,
    placeholder: '',
    onEnter: () => false,
  });

  const publish = useCallback(async () => {
    if (!editor?.getText()) {
      return;
    }

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

    try {
      if (id) {
        await editNote({
          flag: chFlag,
          time: id,
          essay: {
            ...note.essay,
            ...values,
            content: noteContent,
          },
        });
      } else {
        await addNote({
          flag: chFlag,
          essay: {
            ...values,
            content: noteContent,
            author: window.our,
            sent,
          },
        });
      }

      reset();
    } catch (error) {
      console.error(error);
    }
  }, [chFlag, editor, getValues, id, note, reset, addNote, editNote]);

  useEffect(() => {
    if (editor?.isDestroyed) {
      editor?.commands.setContent('');
    }
  }, [editor]);

  useEffect(() => {
    if (editStatus === 'success') {
      navigate(`/groups/${group}/channels/diary/${chFlag}`);
    } else if (addStatus === 'success' && returnTime) {
      navigate(`/groups/${group}/channels/diary/${chFlag}?new=${returnTime}`);
    }
  }, [addStatus, chFlag, editStatus, group, navigate, returnTime]);

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
              disabled={
                !editor?.getText() ||
                editStatus === 'loading' ||
                addStatus === 'loading'
              }
              className={cn(
                'small-button bg-blue text-white disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:text-gray-400'
              )}
              onClick={publish}
            >
              {editStatus === 'loading' || addStatus === 'loading' ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : editStatus === 'error' || addStatus === 'error' ? (
                'Error'
              ) : (
                'Save'
              )}
            </button>
          </div>
        </header>
      }
    >
      {loadingNote && fetchStatus !== 'idle' ? (
        <div className="flex h-full w-full items-center justify-center">
          <LoadingSpinner className="h-6 w-6" />
        </div>
      ) : (
        <FormProvider {...form}>
          <div className="mx-auto max-w-xl p-4">
            <form className="space-y-6">
              <CoverImageInput url="" noteId={id} />
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
      )}
    </Layout>
  );
}
