import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ElipsisIcon from '@/components/icons/EllipsisIcon';

interface EditSectionDropDownProps {
  handleEditClick: () => void;
  handleDeleteClick: () => void;
}

export default function EditSectionDropDown({
  handleEditClick,
  handleDeleteClick,
}: EditSectionDropDownProps) {
  return (
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
          onSelect={handleDeleteClick}
        >
          <span className="text-red">Delete Section</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
