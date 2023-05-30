import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useAddNoteFeelMutation } from '@/state/diary';
import { NoteSeal } from '@/types/diary';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import NoteReaction from './NoteReaction';

interface NotReactionsProps {
  whom: string;
  seal: NoteSeal;
  time: string;
}

export default function NoteReactions({ whom, seal, time }: NotReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { mutateAsync: addFeel } = useAddNoteFeelMutation();
  const feels = _.invertBy(seal.feels);

  const onEmoji = useCallback(
    async (emoji) => {
      await addFeel({ flag: whom, noteId: time, feel: emoji.shortcodes });
    },
    [whom, time, addFeel]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="my-2 flex items-center space-x-2">
      {Object.entries(feels).map(([feel, ships]) => (
        <NoteReaction
          key={feel}
          time={time}
          ships={ships}
          feel={feel}
          whom={whom}
        />
      ))}
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
    </div>
  );
}
