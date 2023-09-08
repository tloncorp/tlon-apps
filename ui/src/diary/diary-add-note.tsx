import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { daToUnix, unixToDa } from '@urbit/api';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import cn from 'classnames';
import _ from 'lodash';
import bigInt from 'big-integer';
import CoverImageInput from '@/components/CoverImageInput';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import Layout from '@/components/Layout/Layout';
import { diaryMixedToJSON, JSONToInlines } from '@/logic/tiptap';
import {
  useAddNoteMutation,
  useEditNoteMutation,
  useNote,
} from '@/state/channel/channel';
import { useChannel, useGroup, useRouteGroup } from '@/state/groups';
import { Block as DiaryBlock, Story } from '@/types/channel';
import { Inline, JSONContent } from '@/types/content';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import PencilIcon from '@/components/icons/PencilIcon';
import { useIsMobile } from '@/logic/useMedia';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import asyncCallWithTimeout from '@/logic/asyncWithTimeout';
import Setting from '@/components/Settings/Setting';
import { useMarkdownInDiaries, usePutEntryMutation } from '@/state/settings';
import { useChannelCompatibility } from '@/logic/channel';
import Tooltip from '@/components/Tooltip';
import MobileHeader from '@/components/MobileHeader';
import getHanDataFromEssay from '@/logic/getHanData';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';
import DiaryMarkdownEditor from './DiaryMarkdownEditor';

export default function DiaryAddNote() {
  const { chShip, chName, id } = useParams();
  const initialTime = useMemo(() => unixToDa(Date.now()).toString(), []);
  const [loaded, setLoaded] = useState(false);
  const [extraTitleRow, setExtraTitleRow] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const channel = useChannel(flag, nest);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    note,
    isLoading: loadingNote,
    fetchStatus,
  } = useNote(nest, id || '0', !id);
  const { title, image } = getHanDataFromEssay(note.essay);
  const { mutateAsync: editNote, status: editStatus } = useEditNoteMutation();
  const {
    data: returnTime,
    mutateAsync: addNote,
    status: addStatus,
  } = useAddNoteMutation();
  const { mutate: toggleMarkdown, status: toggleMarkdownStatus } =
    usePutEntryMutation({ bucket: 'diary', key: 'markdown' });
  const editWithMarkdown = useMarkdownInDiaries();
  const { compatible, text } = useChannelCompatibility(`diary/${chFlag}`);

  const form = useForm<{ title: string; image: string }>({
    defaultValues: {
      title: title || '',
      image: image || '',
    },
  });

  const { reset, register, getValues, watch, setValue } = form;
  const { ref, ...titleRegisterRest } = register('title');
  const watchedTitle = watch('title');

  // expand title to 2 rows if needed, beyond that we can scroll
  useEffect(() => {
    if (extraTitleRow) return;
    if (!titleRef.current) return;
    if (titleRef.current.scrollHeight > titleRef.current.clientHeight) {
      setExtraTitleRow(true);
    }
  }, [watchedTitle, extraTitleRow]);

  const editor = useDiaryInlineEditor({
    content: '',
    placeholder: '',
    onEnter: () => false,
  });

  const setEditorContent = useCallback(
    (content: JSONContent) => {
      if (editor?.isDestroyed) {
        return;
      }
      editor?.commands.setContent(content);
    },
    [editor]
  );

  useEffect(() => {
    if (editor && !loadingNote && note?.essay && editor.isEmpty && !loaded) {
      setValue('title', title || '');
      setValue('image', image || '');
      editor.commands.setContent(diaryMixedToJSON(note?.essay?.content || []));
      setLoaded(true);
    }
  }, [editor, loadingNote, note, loaded, image, setValue, title]);

  const publish = useCallback(async () => {
    if (!editor?.getText() || watchedTitle === '') {
      return;
    }

    const data = JSONToInlines(editor?.getJSON(), false, true);
    const values = getValues();

    const isBlock = (c: Inline | DiaryBlock) =>
      ['image', 'cite', 'listing', 'header', 'rule', 'code'].some(
        (k) => typeof c !== 'string' && k in c
      );
    const noteContent: Story = [];
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
          nest: `diary/${chFlag}`,
          time: id,
          essay: {
            ...note.essay,
            ...values,
            content: noteContent,
          },
        });
      } else {
        await asyncCallWithTimeout(
          addNote({
            initialTime,
            nest: `diary/${chFlag}`,
            essay: {
              content: noteContent,
              author: window.our,
              sent: daToUnix(bigInt(initialTime)),
              'han-data': {
                diary: {
                  ...values,
                },
              },
            },
          }),
          3000
        );
        captureGroupsAnalyticsEvent({
          name: 'post_item',
          groupFlag: flag,
          chFlag,
          channelType: 'diary',
          privacy,
        });
      }

      reset();
    } catch (error) {
      navigate(`/groups/${flag}/channels/diary/${chFlag}`);
      console.error(error);
    }
  }, [
    flag,
    chFlag,
    privacy,
    editor,
    getValues,
    id,
    note,
    reset,
    addNote,
    editNote,
    initialTime,
    navigate,
    watchedTitle,
  ]);

  useEffect(() => {
    if (editStatus === 'success') {
      navigate(`/groups/${flag}/channels/diary/${chFlag}`);
    } else if (addStatus === 'success' && returnTime) {
      navigate(`/groups/${flag}/channels/diary/${chFlag}?new=${returnTime}`);
    }
  }, [addStatus, chFlag, editStatus, flag, navigate, returnTime]);

  return (
    <Layout
      className="align-center w-full flex-1 bg-white"
      mainClass="overflow-y-auto"
      header={
        isMobile ? (
          <MobileHeader
            title={
              <div className="w-full truncate">
                {watchedTitle || 'New Note'}
              </div>
            }
            pathBack=".."
            action={
              <div className="flex h-12 items-center justify-end space-x-2">
                <ReconnectingSpinner />
                <Tooltip content={text} open={compatible ? false : undefined}>
                  <button
                    disabled={
                      !compatible ||
                      !editor?.getText() ||
                      editStatus === 'loading' ||
                      addStatus === 'loading' ||
                      watchedTitle === ''
                    }
                    className={cn(
                      'text-[17px] disabled:text-gray-400 dark:disabled:text-gray-400'
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
                </Tooltip>
              </div>
            }
          />
        ) : (
          <header
            className={cn(
              'flex items-center justify-between border-b-2 border-gray-50 bg-white py-2 pl-2 pr-4'
            )}
          >
            <Link
              to={!editor?.getText() && !id ? `../..` : `../../note/${id}`}
              className={cn(
                'default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2',
                isMobile && ''
              )}
              aria-label="Exit Editor"
            >
              <div className="flex h-6 w-6 items-center justify-center">
                <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
              </div>

              <div className="flex h-6 w-6 items-center justify-center">
                <PencilIcon className="h-3 w-3 text-gray-600" />
              </div>
              <span className="ellipsis text-lg font-bold line-clamp-1 sm:text-sm sm:font-semibold">
                Editing
              </span>
            </Link>

            <div className="flex shrink-0 flex-row items-center space-x-3">
              <Tooltip content={text} open={compatible ? false : undefined}>
                <button
                  disabled={
                    !compatible ||
                    !editor?.getText() ||
                    editStatus === 'loading' ||
                    addStatus === 'loading' ||
                    watchedTitle === ''
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
              </Tooltip>
            </div>
          </header>
        )
      }
    >
      {loadingNote && fetchStatus !== 'idle' ? (
        <div className="flex h-full w-full items-center justify-center">
          <LoadingSpinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <Helmet>
            <title>
              {channel && group
                ? id && note
                  ? `Editing ${title} in ${channel.meta.title} • ${group.meta.title} • Groups`
                  : `Creating Note in ${channel.meta.title} • ${group.meta.title} • Groups`
                : 'Groups'}
            </title>
          </Helmet>
          <FormProvider {...form}>
            <div className="mx-auto h-full max-w-xl p-4">
              <form className="space-y-6">
                <CoverImageInput url="" noteId={id} />
                <textarea
                  placeholder="New Title"
                  className="input-transparent w-full resize-none text-3xl font-medium leading-10"
                  rows={extraTitleRow ? 2 : 1}
                  ref={(e) => {
                    ref(e);
                    titleRef.current = e;
                  }}
                  {...titleRegisterRest}
                />
              </form>
              <div className="h-full py-6">
                <Setting
                  on={editWithMarkdown}
                  toggle={() => toggleMarkdown({ val: !editWithMarkdown })}
                  name="Edit with Markdown"
                  status={toggleMarkdownStatus}
                  className="mb-4"
                />
                {editWithMarkdown && editor ? (
                  <DiaryMarkdownEditor
                    editorContent={editor.getJSON()}
                    setEditorContent={setEditorContent}
                    loaded={loaded}
                    newNote={!id}
                  />
                ) : null}
                {!editWithMarkdown && editor ? (
                  <DiaryInlineEditor editor={editor} />
                ) : null}
              </div>
            </div>
          </FormProvider>
        </>
      )}
    </Layout>
  );
}
