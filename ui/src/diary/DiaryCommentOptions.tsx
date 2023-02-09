import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { useCopy, canWriteChannel } from '@/logic/utils';
import { useAmAdmin, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import { useChatPerms } from '@/state/chat';
import IconButton from '@/components/IconButton';
import BubbleIcon from '@/components/icons/BubbleIcon';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import FaceIcon from '@/components/icons/FaceIcon';
import ShareIcon from '@/components/icons/ShareIcon';
import XIcon from '@/components/icons/XIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import EmojiPicker from '@/components/EmojiPicker';
import { DiaryQuip } from '@/types/diary';
import { useDiaryState } from '@/state/diary';
import ConfirmationModal from '@/components/ConfirmationModal';
import useRequestState from '@/logic/useRequestState';

export default function DiaryCommentOptions({
  whom,
  noteId,
  quip,
  time,
  hideReply,
}: {
  whom: string;
  noteId: string;
  quip: DiaryQuip;
  time: string;
  hideReply?: boolean;
}) {
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const { didCopy, doCopy } = useCopy(
    `/1/chan/diary/${whom}/note/${noteId}/msg/${time}`
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const {
    isPending: isDeletePending,
    setPending: setDeletePending,
    setReady: setDeleteReady,
    setFailed: setDeleteFailed,
  } = useRequestState();

  const onDelete = async () => {
    setDeletePending();
    try {
      await useDiaryState.getState().delQuip(whom, noteId, time);
      await useDiaryState.getState().fetchNote(chFlag, noteId);
    } catch (e) {
      setDeleteFailed();
      console.error('Failed to delete comment', e);
    }
    setDeleteReady();
  };

  const onCopy = useCallback(() => {
    doCopy();
  }, [doCopy]);

  // const reply = useCallback(() => {
  // useChatStore.getState().reply(whom, writ.seal.id);
  // }, [writ, whom]);

  const onEmoji = useCallback(
    async (emoji: { shortcodes: string }) => {
      console.log({ whom, noteId, time, emoji, feel: emoji.shortcodes });
      try {
        await useDiaryState
          .getState()
          .addQuipFeel(whom, noteId, time, emoji.shortcodes);
        await useDiaryState.getState().fetchNote(chFlag, noteId);
      } catch (e) {
        console.error('Failed to add emoji', e);
      }
      setPickerOpen(false);
    },
    [noteId, time, whom, chFlag]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

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
      {/* !writ.memo.replying && writ.memo.replying?.length !== 0 && !hideReply ? (
        <>
          {/*
          TODO: Add replies back in post-demo.
          <IconButton
            icon={<BubbleIcon className="h-6 w-6 text-gray-400" />}
            label="Reply"
            showTooltip
            action={reply}
          />
        </>
      ) : null
      */}
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
      {isAdmin || window.our === quip.memo.author ? (
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
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
        confirmText="Delete"
        onConfirm={onDelete}
        open={deleteOpen}
        setOpen={setDeleteOpen}
        loading={isDeletePending}
      />
    </div>
  );
}
