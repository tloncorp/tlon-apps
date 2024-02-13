import ActionMenu, { Action } from '@/components/ActionMenu';
import ConfirmationModal from '@/components/ConfirmationModal';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import { useGroupCompatibility, useRouteGroup } from '@/state/groups';
import cn from 'classnames';
import { useState } from 'react';

interface EditSectionDropDownProps {
  handleEditClick: () => void;
  handleDeleteClick: () => void;
}

export default function EditSectionDropDown({
  handleEditClick,
  handleDeleteClick,
}: EditSectionDropDownProps) {
  const group = useRouteGroup();
  const { compatible } = useGroupCompatibility(group);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const actions: Action[] = [
    {
      key: 'edit',
      onClick: handleEditClick,
      content: 'Edit Section',
    },
    {
      key: 'delete',
      type: 'destructive',
      onClick: () => setDeleteOpen(true),
      content: 'Delete Section',
    },
  ];

  return (
    <>
      <ActionMenu
        open={open}
        onOpenChange={setOpen}
        actions={actions}
        disabled={!compatible}
        triggerClassName="cursor-pointer"
      >
        <button>
          <ElipsisIcon
            className={cn(
              'h-5 w-5',
              compatible ? 'text-gray-600' : 'text-gray-200'
            )}
          />
        </button>
      </ActionMenu>
      <ConfirmationModal
        open={deleteOpen}
        setOpen={setDeleteOpen}
        onConfirm={handleDeleteClick}
        confirmText="Delete"
        title="Delete Section"
        message="Are you sure you want to delete this section?"
      />
    </>
  );
}
