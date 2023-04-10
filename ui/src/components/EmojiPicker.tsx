import React, { useCallback, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import * as Popover from '@radix-ui/react-popover';
import useEmoji from '@/state/emoji';
import { useIsMobile } from '@/logic/useMedia';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useChatState } from '@/state/chat';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';

interface EmojiPickerProps extends Record<string, any> {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  children?: React.ReactChild;
  withTrigger?: boolean;
}

export default function EmojiPicker({
  open,
  setOpen,
  children,
  withTrigger = true,
  ...props
}: EmojiPickerProps) {
  const { data, load } = useEmoji();
  const { chName, chShip, writShip, writTime } = useParams<{
    chName: string;
    chShip: string;
    writShip: string;
    writTime: string;
  }>();
  const navigate = useNavigate();
  const whom = `${chShip}/${chName}`;
  const writId = `${writShip}/${writTime}`;
  const { state: backgroundLocation } = useLocation();
  const isMobile = useIsMobile();
  const width = window.innerWidth;
  const mobilePerLineCount = Math.floor((width - 10) / 36);

  useEffect(() => {
    load();
  }, [load]);

  const mobileOnOpenChange = (o: boolean) => {
    if (o) {
      navigate(backgroundLocation);
    }
  };

  const onEmojiSelect = useCallback(
    (emoji: { shortcodes: string }) => {
      useChatState.getState().addFeel(whom, writId, emoji.shortcodes);
      navigate(backgroundLocation);
    },
    [whom, writId, backgroundLocation, navigate]
  );

  return (
    <Popover.Root
      defaultOpen={isMobile}
      open={isMobile ? undefined : open}
      onOpenChange={isMobile ? mobileOnOpenChange : setOpen}
    >
      {withTrigger && !isMobile ? (
        <Popover.Trigger asChild>{children}</Popover.Trigger>
      ) : !isMobile ? (
        children
      ) : null}
      {(isMobile || !withTrigger) && (
        <Popover.Anchor className={isMobile ? 'fixed inset-x-0 top-10' : ''} />
      )}
      <Popover.Portal>
        <Popover.Content
          className={isMobile ? '' : 'pl-[100px] pt-[100px]'}
          side="bottom"
          sideOffset={30}
          collisionPadding={15}
          onInteractOutside={
            isMobile ? () => navigate(backgroundLocation) : undefined
          }
        >
          <div className="z-50 mx-10 flex h-96 w-72 items-center justify-center">
            {data ? (
              <Picker
                data={data}
                autoFocus={isMobile}
                perLine={isMobile ? mobilePerLineCount : 9}
                previewPosition="none"
                onEmojiSelect={isMobile ? onEmojiSelect : undefined}
                {...props}
              />
            ) : (
              <div className="flex h-96 w-72 items-center justify-center">
                <LoadingSpinner className="h-6 w-6" />
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
