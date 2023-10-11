import React, { PropsWithChildren, useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useArrangedNotes, usePostToggler } from '@/state/diary';
import { useChannelCompatibility } from '@/logic/channel';
import { getFlagParts } from '@/logic/utils';
import ActionMenu, { Action } from '@/components/ActionMenu';
import useDiaryActions from './useDiaryActions';

type DiaryNoteOptionsDropdownProps = PropsWithChildren<{
  time: string;
  flag: string;
  canEdit: boolean;
  author: string;
  triggerClassName?: string;
}>;

export default function DiaryNoteOptionsDropdown({
  children,
  flag,
  time,
  author,
  triggerClassName,
  canEdit,
}: DiaryNoteOptionsDropdownProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const arrangedNotes = useArrangedNotes(flag);
  const { ship } = getFlagParts(flag);
  const nest = `diary/${flag}`;
  const { compatible } = useChannelCompatibility(nest);
  const {
    isOpen,
    didCopy,
    onCopy,
    delNote,
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

  const actions: Action[] = [
    {
      key: 'copy',
      content: didCopy ? 'Link Copied!' : 'Copy Note Link',
      onClick: onCopy,
      keepOpenOnClick: true,
    },
  ];

  if ((canEdit && ship === window.our) || (canEdit && compatible)) {
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
        confirmText="Delete"
      />
    </>
  );
}
