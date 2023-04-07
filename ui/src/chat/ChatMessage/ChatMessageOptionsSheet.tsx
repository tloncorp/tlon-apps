import cn from 'classnames';
import ConfirmationModal from '@/components/ConfirmationModal';
import BubbleIcon from '@/components/icons/BubbleIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import FaceIcon from '@/components/icons/FaceIcon';
import HashIcon from '@/components/icons/HashIcon';
import XIcon from '@/components/icons/XIcon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Sheet, { SheetContent } from '@/components/Sheet';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import useRequestState from '@/logic/useRequestState';
import { canWriteChannel, useCopy } from '@/logic/utils';
import { useChatPerms, useChatState } from '@/state/chat';
import useEmoji from '@/state/emoji';
import { useAmAdmin, useGroup, useRouteGroup, useVessel } from '@/state/groups';
import { ChatWrit } from '@/types/chat';
import Picker from '@emoji-mart/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export default function ChatMessageOptionsSheet({
  sheetOpen,
  setSheetOpen,
  whom,
  writ,
  hideReply = false,
  hideThreadReply = false,
}: {
  sheetOpen: boolean;
  setSheetOpen: (value: boolean) => void;
  whom: string;
  writ: ChatWrit;
  hideReply?: boolean;
  hideThreadReply?: boolean;
}) {
  const { data, load } = useEmoji();
  const [showPicker, setShowPicker] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const width = window.innerWidth;
  const mobilePerLineCount = Math.floor((width - 20) / 36);
  const [_searchParams, setSearchParams] = useSearchParams();
  const {
    isPending: isDeletePending,
    setPending: setDeletePending,
    setReady,
  } = useRequestState();
  const { didCopy, doCopy } = useCopy(
    `/1/chan/chat/${whom}/msg/${writ.seal.id}`
  );
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const isAdmin = useAmAdmin(groupFlag);

  useEffect(() => {
    load();
  }, [load]);

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
    setSearchParams({ chat_reply: writ.seal.id }, { replace: true });
  }, [writ, setSearchParams]);

  const onEmoji = useCallback(
    (emoji: { shortcodes: string }) => {
      useChatState.getState().addFeel(whom, writ.seal.id, emoji.shortcodes);
      setSheetOpen(false);
    },
    [whom, writ, setSheetOpen]
  );

  const actionWrapper = useCallback(
    (action: () => void) => () => {
      action();
      setSheetOpen(false);
    },
    [setSheetOpen]
  );

  return (
    <Sheet open={sheetOpen} onOpenChange={(o) => setSheetOpen(o)}>
      <SheetContent className={cn({ hidden: deleteOpen })}>
        {!showPicker ? (
          <div className="flex flex-col pt-4">
            {canWrite ? (
              <SidebarItem
                icon={
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                    <FaceIcon className="h-6 w-6" />
                  </div>
                }
                onClick={() => setShowPicker(true)}
              >
                Add Reaction
              </SidebarItem>
            ) : null}
            {!hideReply ? (
              <SidebarItem
                icon={
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                    <BubbleIcon className="h-6 w-6" />
                  </div>
                }
                onClick={actionWrapper(reply)}
              >
                Reply
              </SidebarItem>
            ) : null}
            {!writ.memo.replying &&
            writ.memo.replying?.length !== 0 &&
            !hideThreadReply ? (
              <SidebarItem
                icon={
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                    <HashIcon className="h-6 w-6" />
                  </div>
                }
                to={`message/${writ.seal.id}`}
              >
                Thread Reply
              </SidebarItem>
            ) : null}
            {groupFlag ? (
              <SidebarItem
                icon={
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                    {didCopy ? (
                      <CheckIcon className="h-6 w-6" />
                    ) : (
                      <CopyIcon className="h-6 w-6" />
                    )}
                  </div>
                }
                onClick={actionWrapper(onCopy)}
              >
                Copy
              </SidebarItem>
            ) : null}
            {isAdmin || window.our === writ.memo.author ? (
              <SidebarItem
                icon={
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                    <XIcon className="h-6 w-6 text-red" />
                  </div>
                }
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </SidebarItem>
            ) : null}
          </div>
        ) : (
          <div className="flex h-[200px] w-full flex-col items-center justify-center space-y-2 pt-8">
            {data ? (
              <Picker
                data={data}
                perLine={mobilePerLineCount}
                previewPosition="none"
                navPosition="bottom"
                searchPosition="none"
                onEmojiSelect={onEmoji}
                noCountryFlags={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <LoadingSpinner className="h-6 w-6" />
              </div>
            )}
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
      </SheetContent>
    </Sheet>
  );
}
