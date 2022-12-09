import React, { useCallback, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useDismissNavigate } from '@/logic/routing';
import { EditCurioFormSchema } from '@/types/heap';
import { useForm } from 'react-hook-form';
import { useHeapState } from '@/state/heap/heap';
import { useChannelFlag } from '@/hooks';
import { isLinkCurio, isValidUrl } from '@/logic/utils';
import useRequestState from '@/logic/useRequestState';
import { JSONContent } from '@tiptap/core';
import { inlinesToJSON, inlineToString, JSONToInlines } from '@/logic/tiptap';
import { ChatBlock } from '@/types/chat';
import { Inline } from '@/types/content';
import useCurioFromParams from './useCurioFromParams';
import HeapTextInput from './HeapTextInput';

export default function EditCurioForm() {
  const dismiss = useDismissNavigate();
  const [draftLink, setDraftLink] = useState<string>();
  const [draftText, setDraftText] = useState<JSONContent>();
  const chFlag = useChannelFlag() || '';
  const { curio, time } = useCurioFromParams();
  const isLinkMode = curio ? isLinkCurio(curio.heart.content) : false;
  const { isPending, setPending, setReady } = useRequestState();
  const firstInline = curio && curio.heart.content.inline[0];

  const defaultValues: EditCurioFormSchema = {
    title: curio ? curio.heart.title : '',
    content:
      curio &&
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

  const onDelete = useCallback(async () => {
    if (!chFlag) {
      return;
    }
    if (!time) {
      return;
    }

    await useHeapState.getState().delCurio(chFlag, time.toString());
    dismiss();
  }, [chFlag, dismiss, time]);

  const onSubmit = useCallback(
    async ({ content, title }: EditCurioFormSchema) => {
      if (!chFlag) {
        return;
      }
      if (!curio) {
        return;
      }
      const editedContent = isLinkMode
        ? [content]
        : (JSONToInlines(draftText || {}) as Inline[]);

      const con = {
        block: [] as ChatBlock[],
        inline: editedContent,
      };

      try {
        setPending();
        await useHeapState
          .getState()
          .editCurio(chFlag, time?.toString() || '', {
            ...curio.heart,
            ...{ title, content: con },
          });
        setReady();
        dismiss();
      } catch (error) {
        setReady();
        console.log(error);
      }
    },
    [chFlag, curio, isLinkMode, draftText, setPending, time, setReady, dismiss]
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
    if (curio && !isLinkMode) {
      const parsed = inlinesToJSON(curio.heart.content.inline);
      setDraftText(parsed);
    }
  }, [curio, isLinkMode]);

  return (
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
          sendDisabled={true}
        />
      )}

      <footer className="mt-4 flex items-center justify-between space-x-2">
        <div>
          <button
            type="button"
            className="button bg-red-soft text-red"
            onClick={onDelete}
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
            disabled={isPending || !isValidInput || !curio}
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </footer>
    </form>
  );
}
