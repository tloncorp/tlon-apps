import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useChatState } from '@/state/chat';
import React, { useCallback, useState } from 'react';
import { ChatSeal } from '../../types/chat';
import ChatReaction from './ChatReaction';

interface ChatReactionsProps {
  whom: string;
  seal: ChatSeal;
}

export default function ChatReactions({ whom, seal }: ChatReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      useChatState.getState().addFeel(whom, seal.id, emoji.shortcodes);
      setPickerOpen(false);
    },
    [whom, seal]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="my-2 flex items-center space-x-2">
      {Object.entries(seal.feels).map(([ship, feel]) => (
        <ChatReaction
          key={feel}
          seal={seal}
          ship={ship}
          feel={feel}
          whom={whom}
        />
      ))}
      <button
        className="appearance-none border-none bg-transparent"
        onClick={openPicker}
        aria-label="Add Reaction"
      >
        <AddReactIcon className="h-6 w-6 text-gray-600" />
      </button>
      <EmojiPicker
        open={pickerOpen}
        setOpen={setPickerOpen}
        onEmojiSelect={onEmoji}
      />
    </div>
  );
}
