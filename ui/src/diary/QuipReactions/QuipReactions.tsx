import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useAddQuipFeelMutation } from '@/state/diary';
import { NoteCork } from '@/types/diary';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import QuipReaction from './QuipReaction';

interface QuipReactionsProps {
  whom: string;
  cork: NoteCork;
  time: string;
  noteId: string;
}

export default function QuipReactions({
  whom,
  cork,
  time,
  noteId,
}: QuipReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const feels = _.invertBy(cork.feels);
  const { mutateAsync: addQuipFeel } = useAddQuipFeelMutation();

  const onEmoji = useCallback(
    async (emoji) => {
      addQuipFeel({ flag: whom, noteId, quipId: time, feel: emoji.shortcodes });
    },
    [whom, time, noteId, addQuipFeel]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="my-2 flex items-center space-x-2">
      {Object.entries(feels).map(([feel, ships]) => (
        <QuipReaction
          key={feel}
          time={time}
          noteId={noteId}
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
