import _ from 'lodash';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import EmojiPicker from '@/components/EmojiPicker';
import AddReactIcon from '@/components/icons/AddReactIcon';
import { useIsMobile } from '@/logic/useMedia';
import { useChatState, useIsDmOrMultiDm } from '@/state/chat';
import { useRouteGroup } from '@/state/groups';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import {
  useAddNoteFeelMutation,
  useAddQuipFeelMutation,
} from '@/state/channel/channel';
import { useIsInThread, useThreadParentId } from '@/logic/utils';
import { NoteSeal, QuipCork } from '@/types/channel';
import ChatReaction from './ChatReaction';

interface ChatReactionsProps {
  whom: string;
  seal: NoteSeal | QuipCork;
  id?: string;
}

export default function ChatReactions({ whom, seal, id }: ChatReactionsProps) {
  const inThread = useIsInThread();
  const threadParentId = useThreadParentId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const feels = _.invertBy(seal.feels);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const groupFlag = useRouteGroup();
  const { privacy } = useGroupPrivacy(groupFlag);
  const isDMOrMultiDM = useIsDmOrMultiDm(whom);
  const { mutate: addChatFeel } = useAddNoteFeelMutation();
  const { mutate: addQuipFeel } = useAddQuipFeelMutation();
  const nest = `chat/${whom}`;

  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      if (isDMOrMultiDM) {
        useChatState.getState().addFeelToDm(whom, seal.id, emoji.shortcodes);
      } else if (inThread) {
        addQuipFeel({
          nest,
          noteId: threadParentId!,
          quipId: seal.id,
          feel: emoji.shortcodes,
        });
      } else {
        addChatFeel({
          nest,
          noteId: seal.id,
          feel: emoji.shortcodes,
        });
      }
      captureGroupsAnalyticsEvent({
        name: 'react_item',
        groupFlag,
        chFlag: whom,
        channelType: 'chat',
        privacy,
      });
      setPickerOpen(false);
    },
    [
      whom,
      groupFlag,
      privacy,
      seal,
      isDMOrMultiDM,
      addChatFeel,
      nest,
      inThread,
      addQuipFeel,
      threadParentId,
    ]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  return (
    <div id={id} className="my-2 flex items-center space-x-2">
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
