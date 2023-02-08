import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCopy, canWriteChannel } from '@/logic/utils';
import { useAmAdmin, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import { useChatPerms, useChatState } from '@/state/chat';
import { ChatWrit } from '@/types/chat';
import IconButton from '@/components/IconButton';
import BubbleIcon from '@/components/icons/BubbleIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import FaceIcon from '@/components/icons/FaceIcon';
import HashIcon from '@/components/icons/HashIcon';
import ShareIcon from '@/components/icons/ShareIcon';
import XIcon from '@/components/icons/XIcon';
import { useChatStore } from '@/chat/useChatStore';
import CopyIcon from '@/components/icons/CopyIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import EmojiPicker from '@/components/EmojiPicker';
import ConfirmationModal from '@/components/ConfirmationModal';
import useRequestState from '@/logic/useRequestState';

export default function ChatMessageOptions(props: {
  whom: string;
  writ: ChatWrit;
  hideReply?: boolean;
}) {
  const { whom, writ, hideReply } = props;
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const { didCopy, doCopy } = useCopy(
    `/1/chan/chat/${whom}/msg/${writ.seal.id}`
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const {
    isPending: isDeletePending,
    setPending: setDeletePending,
    setReady,
  } = useRequestState();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const onDelete = async () => {
    setDeletePending();
    try {
      await useChatState.getState().delMessage(whom, writ.seal.id);
    } catch (e) {
      console.log('Failed to delete message', e);
    }
    setReady();
  };

  const onCopy = useCallback(() => {
    doCopy();
  }, [doCopy]);

  const reply = useCallback(() => {
    useChatStore.getState().reply(whom, writ.seal.id);
  }, [writ, whom]);

  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      useChatState.getState().addFeel(whom, writ.seal.id, emoji.shortcodes);
      setPickerOpen(false);
    },
    [whom, writ]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  const navigate = useNavigate();
  return (
    <div className="absolute right-2 -top-5 z-10 flex space-x-0.5 rounded-lg border border-gray-100 bg-white p-[1px] align-middle opacity-0 group-one-hover:opacity-100">
      {canWrite ? (
        <EmojiPicker
          open={pickerOpen}
          setOpen={setPickerOpen}
          onEmojiSelect={onEmoji}
          withTrigger={false}
        >
          <IconButton
            icon={<FaceIcon className="h-6 w-6 text-gray-400" />}
            label="React"
            showTooltip
            action={openPicker}
          />
        </EmojiPicker>
      ) : null}
      {!writ.memo.replying && writ.memo.replying?.length !== 0 && !hideReply ? (
        <>
          {/*
          TODO: Add replies back in post-demo.
          <IconButton
            icon={<BubbleIcon className="h-6 w-6 text-gray-400" />}
            label="Reply"
            showTooltip
            action={reply}
          />

            */}
          <IconButton
            icon={<HashIcon className="h-6 w-6 text-gray-400" />}
            label="Start Thread"
            showTooltip
            action={() => navigate(`message/${writ.seal.id}`)}
          />
        </>
      ) : null}
      {groupFlag ? (
        <IconButton
          icon={
            didCopy ? (
              <CheckIcon className="h-6 w-6 text-gray-400" />
            ) : (
              <CopyIcon className="h-6 w-6 text-gray-400" />
            )
          }
          label="Copy"
          showTooltip
          action={onCopy}
        />
      ) : null}
      {/* <IconButton
        icon={<ShareIcon className="h-6 w-6 text-gray-400" />}
        label="Send to..."
        showTooltip
        action={() => console.log('send to..')}
      /> */}
      {isAdmin || window.our === writ.memo.author ? (
        <IconButton
          icon={<XIcon className="h-6 w-6 text-red" />}
          label="Delete"
          showTooltip
          action={() => setDeleteOpen(true)}
        />
      ) : null}

      {/* <IconButton
        icon={<EllipsisIcon className="h-6 w-6 text-gray-400" />}
        label="More..."
        showTooltip
        action={() => console.log('More...')}
      /> */}
      <ConfirmationModal
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        onConfirm={onDelete}
        open={deleteOpen}
        setOpen={setDeleteOpen}
        confirmText="Delete"
        loading={isDeletePending}
      />
    </div>
  );
}
