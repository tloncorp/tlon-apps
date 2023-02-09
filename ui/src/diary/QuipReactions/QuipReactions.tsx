import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useDiaryState } from '@/state/diary';
import { NoteCork } from '@/types/diary';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import QuipReaction from './QuipReaction';

interface ChatReactionsProps {
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
}: ChatReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const feels = _.invertBy(cork.feels);

  const onEmoji = useCallback(
    async (emoji) => {
      await useDiaryState
        .getState()
        .addQuipFeel(whom, noteId, time, emoji.shortcodes);
      await useDiaryState.getState().fetchNote(chFlag, noteId);
    },
    [whom, time, chFlag, noteId]
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
