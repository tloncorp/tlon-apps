import * as DialogPrimitive from '@radix-ui/react-dialog';
import { JSONContent } from '@tiptap/core';
import {
  chatStoryFromStory,
  storyFromChatStory,
} from '@tloncorp/shared/dist/urbit/channel';
import { Inline } from '@tloncorp/shared/dist/urbit/content';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';

import ConfirmationModal from '@/components/ConfirmationModal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useChannelFlag } from '@/logic/channel';
import getKindDataFromEssay from '@/logic/getKindData';
import { useDismissNavigate } from '@/logic/routing';
import { JSONToInlines, inlinesToJSON } from '@/logic/tiptap';
import useRequestState from '@/logic/useRequestState';
import { isLinkCurio, isValidUrl } from '@/logic/utils';
import { useEditPostMutation, usePost } from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups';

import HeapTextInput from './HeapTextInput';
import useCurioActions from './useCurioActions';

type EditCurioFormSchema = {
  title: string;
  content: string;
};

export default function EditCurioForm() {
  const dismiss = useDismissNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const groupFlag = useRouteGroup();
  const chFlag = useChannelFlag() || '';
  const nest = `heap/${chFlag}`;
  const navigate = useNavigate();
  const { idTime } = useParams<{ idTime: string }>();
  const { post: note, isLoading } = usePost(nest, idTime || '');
  const contentAsChatStory = useMemo(
    () =>
      isLoading
        ? { inline: [], block: [] }
        : chatStoryFromStory(note.essay.content),
    [note, isLoading]
  );
  const editMutation = useEditPostMutation();
  const isLinkMode = !isLoading ? isLinkCurio(contentAsChatStory) : false;
  const { isPending, setPending, setReady } = useRequestState();
  const firstInline = !isLoading && contentAsChatStory.inline[0];
  const { title } = getKindDataFromEssay(note.essay);
  const { onDelete, isDeleteLoading } = useCurioActions({
    nest,
    time: idTime ?? '',
  });

  const defaultValues: EditCurioFormSchema = {
    title: !isLoading ? title : '',
    content:
      !isLoading &&
      isLinkMode &&
      firstInline &&
      typeof firstInline === 'object' &&
      'link' in firstInline
        ? firstInline.link.href
        : '',
  };

  const { handleSubmit, register, watch } = useForm<EditCurioFormSchema>({
    defaultValues,
  });

  const watchedContent = watch('content');
  const isValidInput = isLinkMode
    ? isValidUrl(watchedContent)
    : Object.keys(draftText || {}).length > 0;

  const onSubmit = useCallback(
    async ({ content, title: curioTitle }: EditCurioFormSchema) => {
      const editedContent = isLinkMode
        ? [{ link: { href: content, content } }]
        : (JSONToInlines(draftText || {}) as Inline[]);

      const con = {
        block: contentAsChatStory.block,
        inline: editedContent,
      };

      setPending();
      editMutation.mutate(
        {
          nest,
          time: idTime?.toString() || '',
          essay: {
            ...note.essay,
            'kind-data': {
              heap: curioTitle || '',
            },
            content: storyFromChatStory(con),
          },
        },
        {
          onSuccess: () => {
            setReady();
            dismiss();
          },
          onError: (error) => {
            setReady();
            console.error(error);
          },
        }
      );
    },
    [
      nest,
      idTime,
      note,
      isLinkMode,
      draftText,
      setPending,
      setReady,
      dismiss,
      editMutation,
      contentAsChatStory,
    ]
  );

  // For Link mode, prevent newline entry + allow submit with Enter
  const onKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();

        if (isPending) {
          return;
        }

        if (isValidInput) {
          setPending();
          await handleSubmit(onSubmit)();
          setReady();
        }
      }
    },
    [handleSubmit, isPending, isValidInput, onSubmit, setPending, setReady]
  );

  const onLinkChange: React.ChangeEventHandler<HTMLTextAreaElement> =
    useCallback((e) => {
      setDraftLink(e.target.value);
    }, []);

  // on load, set the text draft to the persisted state
  useEffect(() => {
    if (
      !isLoading &&
      !isLinkMode &&
      contentAsChatStory.inline.length > 0 &&
      !draftText
    ) {
      const parsed = inlinesToJSON(contentAsChatStory.inline);
      setDraftText(parsed);
    }
  }, [isLoading, isLinkMode, contentAsChatStory.inline, draftText]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
        <div className="sm:w-96">
          <header className="mb-3 flex items-center">
            <h2 className="text-lg font-bold">
              Edit {isLinkMode ? 'Link' : 'Text'}
            </h2>
          </header>
        </div>
        <label className="mb-3 font-semibold">
          Title
          <input
            {...register('title')}
            className="input my-2 block w-full p-1"
            type="text"
          />
        </label>
        {isLinkMode ? (
          <textarea
            {...register('content')}
            className="h-full w-full resize-none rounded-lg bg-gray-50 p-2 text-gray-800 placeholder:align-text-top placeholder:font-semibold placeholder:text-gray-400"
            placeholder="Paste Link Here"
            onKeyDown={onKeyDown}
            onChange={onLinkChange}
            defaultValue={draftLink}
          />
        ) : (
          <HeapTextInput
            draft={draftText}
            setDraft={setDraftText}
            flag={chFlag}
            groupFlag={groupFlag}
            sendDisabled={true}
          />
        )}

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div>
            <button
              type="button"
              className="button bg-red-soft text-red"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="secondary-button ml-auto">Cancel</button>
            </DialogPrimitive.Close>
            <button
              type="submit"
              className="button"
              disabled={isPending || !isValidInput || !note}
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </footer>
      </form>
      <ConfirmationModal
        open={deleteOpen}
        onConfirm={onDelete}
        setOpen={setDeleteOpen}
        closeOnClickOutside={true}
        loading={isDeleteLoading}
        title="Delete Gallery Item"
        confirmText="Delete"
        message="Are you sure you want to delete this gallery item?"
      />
    </>
  );
}
