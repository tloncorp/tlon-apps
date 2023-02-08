import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import ConfirmationModal from '@/components/ConfirmationModal';

interface EditSectionDropDownProps {
  handleEditClick: () => void;
  handleDeleteClick: () => void;
}

export default function EditSectionDropDown({
  handleEditClick,
  handleDeleteClick,
}: EditSectionDropDownProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <div className="cursor-pointer">
            <ElipsisIcon className="h-5 w-5 fill-gray-600" />
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          <DropdownMenu.Item
            className="dropdown-item flex items-center space-x-2"
            onSelect={handleEditClick}
          >
            <span>Edit Section</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-item flex items-center space-x-2"
            onSelect={() => setDeleteOpen(true)}
          >
            <span className="text-red">Delete Section</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
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
