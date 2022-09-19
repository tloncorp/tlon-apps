import React, { useEffect } from 'react';
import Picker from '@emoji-mart/react';
import * as Popover from '@radix-ui/react-popover';
import useEmoji from '@/state/emoji';
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor />
      <Popover.Content sideOffset={8}>
        {data ? (
          <Picker data={data} previewPosition="none" {...props} />
        ) : (
          <div className="flex h-96 w-72 items-center justify-center">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
