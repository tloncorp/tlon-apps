import { PostSeal } from '@tloncorp/shared/dist/urbit/channel';
import _ from 'lodash';
import { useCallback, useState } from 'react';

import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useAddPostReactMutation } from '@/state/channel/channel';

import NoteReaction from './NoteReaction';

interface NotReactionsProps {
  whom: string;
  seal: PostSeal;
  time: string;
}

export default function NoteReactions({ whom, seal, time }: NotReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { mutateAsync: addReact } = useAddPostReactMutation();
  const reacts = _.invertBy(seal.reacts);

  const onEmoji = useCallback(
    async (emoji: any) => {
      await addReact({
        nest: `diary/${whom}`,
        postId: time,
        react: emoji.shortcodes,
      });
    },
    [whom, time, addReact]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div className="my-2 flex items-center space-x-2">
      {Object.entries(reacts).map(([react, ships]) => (
        <NoteReaction
          key={react}
          time={time}
          ships={ships}
          react={react}
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
