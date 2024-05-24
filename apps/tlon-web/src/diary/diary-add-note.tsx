import { constructStory } from '@tloncorp/shared/dist/urbit/channel';
import { JSONContent } from '@tloncorp/shared/dist/urbit/content';
import cn from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';

import CoverImageInput from '@/components/CoverImageInput';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import Setting from '@/components/Settings/Setting';
import Tooltip from '@/components/Tooltip';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import PencilIcon from '@/components/icons/PencilIcon';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { useChannelCompatibility } from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import { JSONToInlines, diaryMixedToJSON } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import {
  useAddPostMutation,
  useEditPostMutation,
  usePost,
} from '@/state/channel/channel';
import { useGroup, useGroupChannel, useRouteGroup } from '@/state/groups';
import { useMarkdownInDiaries, usePutEntryMutation } from '@/state/settings';

import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';
import DiaryMarkdownEditor from './DiaryMarkdownEditor';

export default function DiaryAddNote() {
  const { chShip, chName, id } = useParams();
  const [loaded, setLoaded] = useState(false);
  const [extraTitleRow, setExtraTitleRow] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { privacy } = useGroupPrivacy(flag);
  const channel = useGroupChannel(flag, nest);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    post: note,
    isLoading: loadingNote,
    fetchStatus,
  } = usePost(nest, id || '0', !id);
  const { title, image } = getKindDataFromEssay(note?.essay);
  const {
    mutateAsync: editNote,
    status: editStatus,
    reset: resetEdit,
  } = useEditPostMutation();
  const {
    data: returnTime,
    mutateAsync: addNote,
    status: addStatus,
    reset: resetAdd,
  } = useAddPostMutation(nest);
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
    onUpdate: useCallback(() => {
      if (addStatus === 'error') {
        resetAdd();
      }

      if (editStatus === 'error') {
        resetEdit();
      }
    }, [addStatus, editStatus, resetAdd, resetEdit]),
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
      const content = diaryMixedToJSON(note?.essay?.content || []);
      editor.commands.setContent(content);
      setLoaded(true);
    }
  }, [editor, loadingNote, note, loaded, image, setValue, title]);

  const publish = useCallback(async () => {
    if (!editor?.getText() || watchedTitle === '' || (id && !note)) {
      return;
    }

    const data = JSONToInlines(editor?.getJSON(), false, true);
    const values = getValues();

    const noteContent = constructStory(data, true);
    const now = Date.now();
    const cacheId = {
      author: window.our,
      sent: now,
    };

    try {
      if (id && note) {
        await editNote({
          nest: `diary/${chFlag}`,
          time: id,
          essay: {
            ...note.essay,
            'kind-data': {
              diary: {
                ...values,
              },
            },
            content: noteContent,
          },
        });
      } else {
        await addNote({
          cacheId,
          tracked: true,
          essay: {
            content: noteContent,
            author: window.our,
            sent: now,
            'kind-data': {
              diary: {
                ...values,
              },
            },
          },
        });
        captureGroupsAnalyticsEvent({
          name: 'post_item',
          groupFlag: flag,
          chFlag,
          channelType: 'diary',
          privacy,
        });
      }
    } catch (error) {
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
    addNote,
    editNote,
    watchedTitle,
  ]);

  useEffect(() => {
    if (editStatus === 'success') {
      navigate(`/groups/${flag}/channels/diary/${chFlag}`);
    } else if (addStatus === 'success' && returnTime) {
      navigate(
        `/groups/${flag}/channels/diary/${chFlag}?awaiting=${returnTime}`
      );
    }
  }, [addStatus, chFlag, editStatus, flag, navigate, returnTime]);

  const isLoading = addStatus === 'loading' || editStatus === 'loading';
  const isError = addStatus === 'error' || editStatus === 'error';

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
                      isLoading ||
                      watchedTitle === ''
                    }
                    className={cn(
                      'text-[17px] disabled:text-gray-400 dark:disabled:text-gray-400'
                    )}
                    onClick={publish}
                  >
                    {isLoading ? (
                      <LoadingSpinner className="h-4 w-4" />
                    ) : isError ? (
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
              <span className="ellipsis line-clamp-1 text-lg font-bold sm:text-sm sm:font-semibold">
                Editing
              </span>
            </Link>

            <div className="flex shrink-0 flex-row items-center space-x-3">
              <Tooltip
                content={isError ? 'Your note was unable to be saved' : text}
                open={compatible ? (isError ? undefined : false) : undefined}
              >
                <button
                  disabled={
                    !compatible ||
                    !editor?.getText() ||
                    isLoading ||
                    watchedTitle === ''
                  }
                  className={cn(
                    'small-button min-w-16 text-white disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:text-gray-400',
                    {
                      'bg-blue': !isError,
                      'bg-red': isError,
                    }
                  )}
                  onClick={publish}
                  data-testid="save-note-button"
                >
                  {isLoading ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : isError ? (
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
                  data-testid="note-title-input"
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
                  dataTestid="edit-with-markdown-toggle"
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
