import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { decToUd } from '@urbit/api';
import { useCopy, useIsDmOrMultiDm } from '@/logic/utils';
import { canWriteChannel } from '@/logic/channel';
import { useAmAdmin, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import {
  useAddDMReplyReactMutation,
  useDeleteDMReplyMutation,
} from '@/state/chat';
import IconButton from '@/components/IconButton';
import useEmoji from '@/state/emoji';
import BubbleIcon from '@/components/icons/BubbleIcon';
import FaceIcon from '@/components/icons/FaceIcon';
import XIcon from '@/components/icons/XIcon';
import { useChatDialog } from '@/chat/useChatStore';
import CopyIcon from '@/components/icons/CopyIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import EmojiPicker from '@/components/EmojiPicker';
import ConfirmationModal from '@/components/ConfirmationModal';
import ActionMenu, { Action } from '@/components/ActionMenu';
import useRequestState from '@/logic/useRequestState';
import { useIsMobile } from '@/logic/useMedia';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import AddReactIcon from '@/components/icons/AddReactIcon';
import {
  useAddPostReactMutation,
  useAddReplyReactMutation,
  useDeletePostMutation,
  useDeleteReplyMutation,
  usePerms,
} from '@/state/channel/channel';
import { emptyReply, Reply } from '@/types/channel';

export default function ReplyMessageOptions(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whom: string;
  reply: Reply;
  openReactionDetails: () => void;
  showReply?: boolean;
}) {
  const { open, onOpenChange, whom, reply, openReactionDetails, showReply } =
    props;
  const { cork, memo } = reply ?? emptyReply;
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const threadParentId = cork['parent-id'];
  const { didCopy, doCopy } = useCopy(
    `/1/chan/${whom}/msg/${threadParentId}/${cork.id}`
  );
  const { open: pickerOpen, setOpen: setPickerOpen } = useChatDialog(
    whom,
    cork.id,
    'picker'
  );
  const { open: deleteOpen, setOpen: setDeleteOpen } = useChatDialog(
    whom,
    cork.id,
    'delete'
  );
  const {
    isPending: isDeletePending,
    setPending: setDeletePending,
    setReady,
  } = useRequestState();
  const { chShip, chName } = useParams();
  const isParent = threadParentId === cork.id;
  const [, setSearchParams] = useSearchParams();
  const { load: loadEmoji } = useEmoji();
  const isMobile = useIsMobile();
  const isDMorMultiDM = useIsDmOrMultiDm(whom);
  const perms = usePerms(isDMorMultiDM ? `fake/nest/${whom}` : whom);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const { privacy } = useGroupPrivacy(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: deleteReply } = useDeleteReplyMutation();
  const { mutate: deleteChatMessage } = useDeletePostMutation();
  const { mutate: deleteDMReply } = useDeleteDMReplyMutation();
  const { mutate: addFeelToChat } = useAddPostReactMutation();
  const { mutate: addFeelToReply } = useAddReplyReactMutation();
  const { mutate: addDMReplyFeel } = useAddDMReplyReactMutation();

  const onDelete = async () => {
    if (isMobile) {
      onOpenChange(false);
    }

    setDeletePending();

    try {
      if (isDMorMultiDM) {
        deleteDMReply({
          whom,
          writId: threadParentId!,
          replyId: cork.id,
        });
      } else if (isParent) {
        deleteChatMessage({
          nest: whom,
          time: decToUd(threadParentId),
        });
        navigate(`/groups/${groupFlag}/channels/chat/${chShip}/${chName}`);
      } else {
        deleteReply({
          nest: whom,
          postId: threadParentId!,
          replyId: cork.id,
        });
      }
    } catch (e) {
      console.log('Failed to delete message', e);
    }
    setReady();
  };

  const onCopy = useCallback(() => {
    doCopy();

    if (isMobile) {
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    }
  }, [doCopy, isMobile, onOpenChange]);

  const setReplyParam = useCallback(() => {
    setSearchParams({ reply: cork.id }, { replace: true });
  }, [cork, setSearchParams]);

  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      if (isDMorMultiDM) {
        addDMReplyFeel({
          whom,
          writId: threadParentId!,
          replyId: cork.id,
          react: emoji.shortcodes,
        });
      } else if (isParent) {
        addFeelToChat({
          nest: whom,
          postId: cork.id,
          react: emoji.shortcodes,
        });
      } else {
        addFeelToReply({
          nest: whom,
          postId: threadParentId!,
          replyId: cork.id,
          react: emoji.shortcodes,
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
      cork,
      setPickerOpen,
      addFeelToChat,
      isDMorMultiDM,
      addFeelToReply,
      addDMReplyFeel,
      threadParentId,
      isParent,
    ]
  );

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  useEffect(() => {
    if (isMobile) {
      loadEmoji();
    }
  }, [isMobile, loadEmoji]);

  const showReactAction = canWrite;
  // TODO handle reply replies
  const showCopyAction = !!groupFlag;
  const showDeleteAction = isAdmin || window.our === memo.author;
  const reactionsCount = Object.keys(cork.reacts).length;

  const actions: Action[] = [];

  if (showReactAction) {
    actions.push({
      key: 'react',
      content: (
        <div className="flex items-center" aria-label="React">
          <AddReactIcon className="mr-2 h-6 w-6" />
          React
        </div>
      ),
      onClick: () => {
        navigate(`picker/${cork.id}`, {
          state: { backgroundLocation: location },
        });
      },
    });
  }

  if (reactionsCount > 0) {
    actions.push({
      key: 'show-all-reactions',
      content: (
        <div className="flex items-center">
          <FaceIcon className="mr-2 h-6 w-6" />
          View Reactions
        </div>
      ),
      onClick: () => openReactionDetails(),
      keepOpenOnClick: false,
    });
  }

  if (showReply) {
    actions.push({
      key: 'reply',
      content: (
        <div className="flex items-center">
          <BubbleIcon className="mr-2 h-6 w-6" />
          Reply
        </div>
      ),
      onClick: setReplyParam,
    });
  }

  if (showCopyAction) {
    actions.push({
      key: 'copy',
      content: (
        <div className="flex items-center">
          {didCopy ? (
            <CheckIcon className="mr-2 h-6 w-6" />
          ) : (
            <CopyIcon className="mr-2 h-6 w-6" />
          )}
          {didCopy ? 'Copied!' : 'Copy'}
        </div>
      ),
      onClick: onCopy,
      keepOpenOnClick: true,
    });
  }

  if (showDeleteAction) {
    actions.push({
      key: 'delete',
      type: 'destructive',
      content: (
        <div className="flex items-center">
          <XIcon className="mr-2 h-6 w-6" />
          Delete
        </div>
      ),
      onClick: () => setDeleteOpen(true),
      keepOpenOnClick: true,
    });
  }

  if (!open && !isMobile) {
    return null;
  }

  return (
    <>
      {isMobile ? (
        <ActionMenu open={open} onOpenChange={onOpenChange} actions={actions} />
      ) : (
        <div className="absolute right-2 -top-5 z-10 h-full">
          <div
            data-testid="chat-message-options"
            className="sticky top-0 flex space-x-0.5 rounded-lg border border-gray-100 bg-white p-[1px] align-middle"
          >
            {showReactAction && (
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
                  aria-label="React"
                  action={openPicker}
                />
              </EmojiPicker>
            )}
            {showReply && (
              <IconButton
                icon={<BubbleIcon className="h-6 w-6 text-gray-400" />}
                label="Reply"
                showTooltip
                action={setReplyParam}
              />
            )}
            {showCopyAction && (
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
            )}
            {reactionsCount > 0 && (
              <IconButton
                icon={
                  <span className="align-baseline font-semibold text-gray-400">
                    {reactionsCount}
                  </span>
                }
                label="View Reactions"
                action={openReactionDetails}
              />
            )}
            {showDeleteAction && (
              <IconButton
                icon={<XIcon className="h-6 w-6 text-red" />}
                label="Delete"
                showTooltip
                action={() => setDeleteOpen(true)}
              />
            )}
          </div>
        </div>
      )}
      <ConfirmationModal
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        onConfirm={onDelete}
        open={deleteOpen}
        setOpen={setDeleteOpen}
        confirmText="Delete"
        loading={isDeletePending}
      />
    </>
  );
}
