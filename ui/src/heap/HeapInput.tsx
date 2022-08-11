import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import { intersection } from 'lodash';
import { useForm } from 'react-hook-form';
import LinkIcon from '@/components/icons/LinkIcon';
import TextIcon from '@/components/icons/TextIcon';
import { useHeapPerms, useHeapState } from '@/state/heap/heap';
import useNest from '@/logic/useNest';
import { isValidUrl, nestToFlag } from '@/logic/utils';
import { useRouteGroup, useVessel } from '@/state/groups';
import { GRID, HeapDisplayMode, LIST } from './HeapTypes';

interface HeapInputProps {
  displayType: HeapDisplayMode;
}

interface CurioForm {
  content: string;
}

const LINK = 'link';
const TEXT = 'text';
type InputMode = typeof LINK | typeof TEXT;

export default function HeapInput({ displayType }: HeapInputProps) {
  const [inputMode, setInputMode] = useState<InputMode>(LINK);
  const isGridMode = displayType === GRID;
  const isListMode = displayType === LIST;
  const isLinkMode = inputMode === LINK;
  const isTextMode = inputMode === TEXT;
  const flag = useRouteGroup();
  const nest = useNest();
  const [, chFlag] = nestToFlag(nest);
  const perms = useHeapPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    intersection(perms.writers, vessel.sects).length !== 0;

  const { register, handleSubmit, reset, watch } = useForm<CurioForm>({
    defaultValues: {
      content: '',
    },
  });
  const onSubmit = useCallback(
    async ({ content }: CurioForm) => {
      await useHeapState.getState().addCurio(chFlag, {
        title: null,
        content: [content],
        author: window.our,
        sent: Date.now(),
        replying: null,
      });

      reset();
    },
    [chFlag, reset]
  );

  const watchedContent = watch('content');
  const isValidInput = isLinkMode
    ? isValidUrl(watchedContent)
    : watchedContent.length > 0;

  // TODO: should it be hidden completely? or input disabled?
  if (!canWrite) {
    return null;
  }

  const modeToggle = () => (
    <div className={cn('flex', isGridMode && 'p-1')}>
      <button
        className={cn(
          isLinkMode ? 'button' : 'secondary-button',
          isListMode && 'max-w-[120px] rounded-bl-none',
          'flex-1 rounded-r-none'
        )}
        onClick={() => setInputMode(LINK)}
      >
        <LinkIcon className="mr-1 h-4 w-4" />
        <span className="ml-1">Link</span>
      </button>
      <button
        className={cn(
          isTextMode ? 'button' : 'secondary-button',
          isListMode && 'max-w-[120px] rounded-br-none',
          'flex-1 rounded-l-none'
        )}
        onClick={() => setInputMode(TEXT)}
      >
        <TextIcon className="mr-1 h-4 w-4" />
        <span className="ml-1">Text</span>
      </button>
    </div>
  );

  return (
    <div>
      {isListMode ? modeToggle() : null}
      <div
        className={cn(
          isGridMode ? 'heap-block flex-col' : 'heap-row flex-row',
          'flex cursor-auto'
        )}
      >
        {isGridMode ? modeToggle() : null}
        <form onSubmit={handleSubmit(onSubmit)} className="relative flex-1 p-1">
          <textarea
            autoFocus
            {...register('content')}
            className="h-full w-full resize-none rounded-lg bg-gray-50 p-1 text-gray-800 placeholder:align-text-top placeholder:font-semibold placeholder:text-gray-400"
            placeholder={`${isLinkMode ? 'Paste Link' : 'Enter Text'} Here`}
          />
          <input
            value="Post"
            type="submit"
            className="button absolute bottom-3 right-3 rounded-md px-2 py-1"
            disabled={!isValidInput}
          />
        </form>
      </div>
    </div>
  );
}
