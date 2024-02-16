import ActionMenu, { Action } from '@/components/ActionMenu';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useChannelCompatibility } from '@/logic/channel';
import { getFlagParts } from '@/logic/utils';
import {
  useArrangedPosts,
  useIsPostPending,
  usePostToggler,
} from '@/state/channel/channel';
import { useFlaggedData, useRouteGroup } from '@/state/groups';
import classNames from 'classnames';
import React, { PropsWithChildren, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import useDiaryActions from './useDiaryActions';

type DiaryNoteOptionsDropdownProps = PropsWithChildren<{
  time: string;
  sent: number;
  flag: string;
  canEdit: boolean;
  author: string;
  triggerClassName?: string;
}>;

export default function DiaryNoteOptionsDropdown({
  children,
  flag,
  time,
  sent,
  author,
  triggerClassName,
  canEdit,
}: DiaryNoteOptionsDropdownProps) {
  const groupFlag = useRouteGroup();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const nest = `diary/${flag}`;
  const arrangedNotes = useArrangedPosts(nest);
  const { ship } = getFlagParts(flag);
  const { compatible } = useChannelCompatibility(nest);
  const isPending = useIsPostPending({
    author,
    sent,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    didCopy,
    onCopy,
    delNote,
    isDeleteLoading,
    setIsOpen,
    addToArrangedNotes,
    removeFromArrangedNotes,
    moveUpInArrangedNotes,
    moveDownInArrangedNotes,
  } = useDiaryActions({
    flag,
    time,
  });
  const { show, hide, isHidden } = usePostToggler(time);
  const { isFlaggedByMe } = useFlaggedData(groupFlag, nest, time);

  const actions: Action[] = [
    {
      key: 'copy',
      content: didCopy ? 'Link Copied!' : 'Copy Note Link',
      onClick: onCopy,
      keepOpenOnClick: true,
    },
  ];

  if (!isPending && canEdit && (ship === window.our || compatible)) {
    if (arrangedNotes.includes(time)) {
      actions.push(
        {
          key: 'move_up',
          content: 'Move Up',
          onClick: moveUpInArrangedNotes,
        },
        {
          key: 'move_down',
          content: 'Move Down',
          onClick: moveDownInArrangedNotes,
        },
        {
          key: 'remove_from_pinned_notes',
          content: 'Remove from Pinned Notes',
          onClick: removeFromArrangedNotes,
        }
      );
    } else {
      actions.push({
        key: 'add_to_pinned_notes',
        content: 'Add to Pinned Notes',
        onClick: addToArrangedNotes,
      });
    }

    actions.push(
      {
        key: 'edit',
        content: <Link to={`edit/${time}`}>Edit Note</Link>,
      },
      {
        key: 'delete',
        type: 'destructive',
        content: 'Delete Note',
        onClick: () => setDeleteOpen(true),
      }
    );
  }

  if (author !== window.our) {
    actions.push({
      key: 'hide',
      content: isHidden ? 'Show Note' : 'Hide Note for Me',
      onClick: isHidden ? show : hide,
    });
    actions.push({
      key: 'hide',
      type: isFlaggedByMe ? 'disabled' : 'destructive',
      content: isFlaggedByMe ? "You've flagged this note" : 'Report Note',
      onClick: () => {
        navigate('/report-content', {
          state: {
            backgroundLocation: location,
            groupFlag,
            post: time,
            reply: null,
            nest,
          },
        });
        hide();
      },
    });
  }

  return (
    <>
      <ActionMenu
        open={isOpen}
        onOpenChange={setIsOpen}
        actions={actions}
        asChild={false}
        triggerClassName={classNames('h-8 w-8 p-0', triggerClassName)}
        contentClassName="min-w-[208px]"
        ariaLabel="Note menu"
      >
        {children}
      </ActionMenu>
      <ConfirmationModal
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        onConfirm={delNote}
        open={deleteOpen}
        setOpen={setDeleteOpen}
        loading={isDeleteLoading}
        confirmText="Delete"
      />
    </>
  );
}
