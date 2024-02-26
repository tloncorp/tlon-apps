import { Post, emptyPost } from '@tloncorp/shared/dist/urbit/channel';
import { decToUd } from '@urbit/api';
import cn from 'classnames';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useSearchParams } from 'react-router-dom';

import { useChatDialog } from '@/chat/useChatStore';
import ActionMenu, { Action } from '@/components/ActionMenu';
import ConfirmationModal from '@/components/ConfirmationModal';
import EmojiPicker from '@/components/EmojiPicker';
import IconButton from '@/components/IconButton';
import AddReactIcon from '@/components/icons/AddReactIcon';
import BubbleIcon from '@/components/icons/BubbleIcon';
import CautionIcon from '@/components/icons/CautionIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import FaceIcon from '@/components/icons/FaceIcon';
import HashIcon from '@/components/icons/HashIcon';
import HiddenIcon from '@/components/icons/HiddenIcon';
import PencilIcon from '@/components/icons/PencilSettingsIcon';
import VisibleIcon from '@/components/icons/VisibleIcon';
import XIcon from '@/components/icons/XIcon';
import { captureGroupsAnalyticsEvent } from '@/logic/analytics';
import { canWriteChannel } from '@/logic/channel';
import { inlineSummary } from '@/logic/tiptap';
import useGroupPrivacy from '@/logic/useGroupPrivacy';
import { useIsMobile } from '@/logic/useMedia';
import { useCopy, useIsDmOrMultiDm } from '@/logic/utils';
import {
  useAddPostReactMutation,
  useDeletePostMutation,
  usePerms,
  usePostToggler,
} from '@/state/channel/channel';
import {
  useAddDmReactMutation,
  useDeleteDmMutation,
  useMessageToggler,
} from '@/state/chat';
import useEmoji from '@/state/emoji';
import {
  useAmAdmin,
  useFlaggedData,
  useGroup,
  useRouteGroup,
  useVessel,
} from '@/state/groups';

function ChatMessageOptions(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whom: string;
  writ: Post;
  hideThreadReply?: boolean;
  hideReply?: boolean;
  openReactionDetails: () => void;
}) {
  const {
    open,
    onOpenChange,
    whom,
    writ = emptyPost,
    hideThreadReply,
    hideReply,
    openReactionDetails,
  } = props;
  const { seal, essay } = writ;
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  const { didCopy, doCopy } = useCopy(`/1/chan/chat/${whom}/msg/${seal.id}`);
  const messageText = inlineSummary(writ.essay.content);
  const { didCopy: didCopyText, doCopy: doCopyText } = useCopy(messageText);
  const { open: pickerOpen, setOpen: setPickerOpen } = useChatDialog(
    whom,
    seal.id,
    'picker'
  );
  const { open: deleteOpen, setOpen: setDeleteOpen } = useChatDialog(
    whom,
    seal.id,
    'delete'
  );
  const { chShip, chName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { load: loadEmoji } = useEmoji();
  const isMobile = useIsMobile();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const perms = usePerms(nest);
  const vessel = useVessel(groupFlag, window.our);
  const group = useGroup(groupFlag);
  const { privacy } = useGroupPrivacy(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: addReactToChat } = useAddPostReactMutation();
  const { mutate: addReactToDm } = useAddDmReactMutation();
  const { mutateAsync: deleteDm, isLoading: isDeleteDmLoading } =
    useDeleteDmMutation();
  const { mutateAsync: deleteChatMessage, isLoading: isDeleteLoading } =
    useDeletePostMutation();
  const isDeleting = isDeleteLoading || isDeleteDmLoading;
  const isDMorMultiDM = useIsDmOrMultiDm(whom);
  const {
    show: showPost,
    hide: hidePost,
    isHidden: isPostHidden,
  } = usePostToggler(seal.id);
  const {
    show: showChatMessage,
    hide: hideChatMessage,
    isHidden: isMessageHidden,
  } = useMessageToggler(seal.id);
  const isHidden = useMemo(
    () => isMessageHidden || isPostHidden,
    [isMessageHidden, isPostHidden]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFlaggedByMe } = useFlaggedData(groupFlag, nest, seal.id);

  const onDelete = async () => {
    if (isMobile) {
      onOpenChange(false);
    }

    try {
      if (isDMorMultiDM) {
        await deleteDm({ whom, id: seal.id });
      } else {
        await deleteChatMessage({
          nest,
          time: decToUd(seal.id),
        });
      }
      setDeleteOpen(false);
    } catch (e) {
      console.log('Failed to delete message', e);
    }
  };

  const onCopy = useCallback(() => {
    doCopy();

    if (isMobile) {
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    }
  }, [doCopy, isMobile, onOpenChange]);

  const onCopyText = useCallback(() => {
    doCopyText();

    if (isMobile) {
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    }
  }, [doCopyText, isMobile, onOpenChange]);

  const reply = useCallback(() => {
    setSearchParams({ replyTo: seal.id }, { replace: true });
  }, [seal, setSearchParams]);

  const edit = useCallback(() => {
    setSearchParams({ edit: seal.id }, { replace: true });
  }, [seal, setSearchParams]);

  const startThread = () => {
    navigate(`message/${seal.id}`);
  };

  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      if (isDMorMultiDM) {
        addReactToDm({
          whom,
          id: seal.id,
          react: emoji.shortcodes,
        });
      } else {
        addReactToChat({
          nest,
          postId: seal.id,
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
      seal,
      setPickerOpen,
      addReactToDm,
      addReactToChat,
      nest,
      isDMorMultiDM,
    ]
  );

  const toggleMsg = useCallback(
    () => (isMessageHidden ? showChatMessage() : hideChatMessage()),
    [isMessageHidden, showChatMessage, hideChatMessage]
  );

  const togglePost = useCallback(
    () => (isPostHidden ? showPost() : hidePost()),
    [isPostHidden, showPost, hidePost]
  );

  const reportContent = useCallback(() => {
    navigate('/report-content', {
      state: {
        backgroundLocation: location,
        post: seal.id,
        reply: null,
        nest: `chat/${chFlag}`,
        groupFlag,
      },
    });
    hidePost();
  }, [navigate, hidePost, seal, location, chFlag, groupFlag]);

  const openPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  useEffect(() => {
    if (isMobile) {
      loadEmoji();
    }
  }, [isMobile, loadEmoji]);

  const showReactAction = canWrite;
  const showReplyAction = !hideReply;
  const showCopyAction = !!groupFlag;
  const showDeleteAction = isAdmin || window.our === essay.author;
  const showEditAction = window.our === essay.author;
  const reactionsCount = Object.keys(seal.reacts).length;

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
        navigate(`picker/${seal.id}`, {
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

  if (showReplyAction) {
    actions.push({
      key: 'reply',
      content: (
        <div className="flex items-center">
          <BubbleIcon className="mr-2 h-6 w-6" />
          Reply
        </div>
      ),
      onClick: reply,
    });
  }

  actions.push({
    key: 'thread',
    content: (
      <div className="flex items-center">
        <HashIcon className="mr-2 h-6 w-6" />
        Start Thread
      </div>
    ),
    onClick: () => navigate(`message/${seal.id}`),
  });

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
          {didCopy ? 'Copied!' : 'Copy Link'}
        </div>
      ),
      onClick: onCopy,
      keepOpenOnClick: true,
    });
  }

  actions.push({
    key: 'copyText',
    content: (
      <div className="flex items-center">
        {didCopyText ? (
          <CheckIcon className="mr-2 h-6 w-6" />
        ) : (
          <CopyIcon className="mr-2 h-6 w-6" />
        )}
        {didCopyText ? 'Copied!' : 'Copy Text'}
      </div>
    ),
    onClick: onCopyText,
    keepOpenOnClick: true,
  });

  actions.push({
    key: 'hide',
    onClick: isDMorMultiDM ? toggleMsg : togglePost,
    content: (
      <div className="flex items-center">
        {isHidden ? (
          <>
            <VisibleIcon className="mr-2 h-6 w-6" />
            Show Message
          </>
        ) : (
          <>
            <HiddenIcon className="mr-2 h-6 w-6" />
            Hide Message
          </>
        )}
      </div>
    ),
  });

  if (!isDMorMultiDM) {
    actions.push({
      key: 'report',
      onClick: reportContent,
      type: isFlaggedByMe ? 'disabled' : 'destructive',
      content: (
        <div className="flex items-center">
          <CautionIcon className="mr-2 h-6 w-6" />
          {isFlaggedByMe ? "You've flagged this message" : 'Report Message'}
        </div>
      ),
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

  if (showEditAction) {
    actions.push({
      key: 'edit',
      content: (
        <div className="flex items-center">
          <PencilIcon className="mr-2 h-6 w-6" />
          Edit
        </div>
      ),
      onClick: edit,
    });
  }

  // Ensure options menu is visible even if the top of the message has scrolled
  // off the page.
  useLayoutEffect(() => {
    if (open && !isMobile && containerRef.current) {
      // This also accounts for the height of the header.
      const minTopOffset = 65;
      const rect = containerRef.current.getBoundingClientRect();
      const offset = Math.max(minTopOffset - rect.top, 0);
      containerRef.current.style.transform = `translateY(${`${offset}px`})`;
    }
  }, [open, isMobile]);

  if (!open && !isMobile) {
    return null;
  }

  return (
    <>
      {isMobile ? (
        <ActionMenu open={open} onOpenChange={onOpenChange} actions={actions} />
      ) : (
        <div
          className="absolute -top-5 right-2 z-10 min-h-fit"
          ref={containerRef}
        >
          <div
            data-testid="chat-message-options"
            className="relative top-0 flex space-x-0.5 rounded-lg border border-gray-100 bg-white p-[1px] align-middle"
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
            {showReplyAction && (
              <IconButton
                icon={<BubbleIcon className="h-6 w-6 text-gray-400" />}
                label="Reply"
                showTooltip
                action={reply}
              />
            )}
            {!hideThreadReply && (
              <IconButton
                icon={<HashIcon className="h-6 w-6 text-gray-400" />}
                label="Start Thread"
                showTooltip
                action={startThread}
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
            <IconButton
              icon={
                isHidden ? (
                  <VisibleIcon className="h-6 w-6 text-gray-400" />
                ) : (
                  <HiddenIcon className="h-6 w-6 text-gray-400" />
                )
              }
              label={isHidden ? 'Show Message' : 'Hide Message'}
              showTooltip
              action={isDMorMultiDM ? toggleMsg : togglePost}
            />
            {!isDMorMultiDM && (
              <IconButton
                icon={
                  <CautionIcon
                    className={cn(
                      'h-6 w-6',
                      isFlaggedByMe ? 'text-gray-200' : 'text-gray-400'
                    )}
                  />
                }
                label={
                  isFlaggedByMe
                    ? "You've flagged this message"
                    : 'Report Message'
                }
                showTooltip
                action={reportContent}
                disabled={isFlaggedByMe}
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
            {showEditAction && (
              <IconButton
                icon={<PencilIcon className="h-6 w-6 text-gray-400" />}
                label="Edit"
                showTooltip
                action={edit}
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
        loading={isDeleting}
        closeOnClickOutside={true}
      />
    </>
  );
}

export default React.memo(ChatMessageOptions);
