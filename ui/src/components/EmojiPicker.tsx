import React, { useEffect } from 'react';
import Picker from '@emoji-mart/react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import useEmoji from '@/state/emoji';
import { useIsMobile } from '@/logic/useMedia';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';

interface EmojiPickerProps extends Record<string, any> {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function EmojiPicker({
  open,
  setOpen,
  ...props
}: EmojiPickerProps) {
  const { data, load } = useEmoji();
  const isMobile = useIsMobile();
  const width = window.innerWidth;
  const mobilePerLineCount = Math.floor((width - 10) / 36);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor className={isMobile ? 'fixed inset-x-0 top-12' : ''} />
      <Popover.Content sideOffset={8}>
        {data ? (
          <Picker
            data={data}
            autoFocus={isMobile}
            perLine={isMobile ? mobilePerLineCount : 9}
            previewPosition="none"
            {...props}
          />
        ) : (
          <div className="flex h-96 w-72 items-center justify-center">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
