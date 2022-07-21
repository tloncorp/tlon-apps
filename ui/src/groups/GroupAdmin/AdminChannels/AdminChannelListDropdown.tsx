import React from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import ElipsisIcon from '@/components/icons/EllipsisIcon';

interface AdminChannelListDropdownProps {
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editIsOpen: boolean;
  setDeleteChannelIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deleteChannelIsOpen: boolean;
}

export default function AdminChannelListDropdown({
  setEditIsOpen,
  editIsOpen,
  setDeleteChannelIsOpen,
  deleteChannelIsOpen,
}: AdminChannelListDropdownProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <div className="default-focus flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-50">
          <ElipsisIcon className="h-5 w-5" />
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.Item
          className="dropdown-item"
          onClick={() => setEditIsOpen(!editIsOpen)}
        >
          Edit Channel
        </Dropdown.Item>
        <Dropdown.Item
          className="dropdown-item text-red"
          onClick={() => setDeleteChannelIsOpen(!deleteChannelIsOpen)}
        >
          Delete Channel
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
