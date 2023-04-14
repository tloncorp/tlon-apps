import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useIsMobile } from '@/logic/useMedia';
import { useChatState } from '@/state/chat';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChatSeal } from '../../types/chat';
import ChatReaction from './ChatReaction';

interface ChatReactionsProps {
  whom: string;
  seal: ChatSeal;
}

export default function ChatReactions({ whom, seal }: ChatReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const feels = _.invertBy(seal.feels);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

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
      {Object.entries(feels).map(([feel, ships]) => (
        <ChatReaction
          key={feel}
          seal={seal}
          ships={ships}
          feel={feel}
          whom={whom}
        />
      ))}
      {!isMobile ? (
        <EmojiPicker
          open={pickerOpen}
          setOpen={setPickerOpen}
          onEmojiSelect={onEmoji}
        >
          <button
            className="appearance-none border-none bg-transparent"
            onClick={openPicker}
            aria-label="Add Reaction"
          >
            <AddReactIcon className="h-6 w-6 text-gray-400" />
          </button>
        </EmojiPicker>
      ) : (
        <button
          className="appearance-none border-none bg-transparent"
          onClick={() =>
            navigate(`picker/${seal.id}`, {
              state: { backgroundLocation: location },
            })
          }
          aria-label="Add Reaction"
        >
          <AddReactIcon className="h-6 w-6 text-gray-400" />
        </button>
      )}
    </div>
  );
}
