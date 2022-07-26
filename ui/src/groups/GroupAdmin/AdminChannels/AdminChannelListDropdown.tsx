import React, { useState } from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import ElipsisIcon from '@/components/icons/EllipsisIcon';

interface AdminChannelListDropdownProps {
  parentIsHovered: boolean;
  setEditIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editIsOpen: boolean;
  setDeleteChannelIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deleteChannelIsOpen: boolean;
}

export default function AdminChannelListDropdown({
  parentIsHovered,
  setEditIsOpen,
  editIsOpen,
  setDeleteChannelIsOpen,
  deleteChannelIsOpen,
}: AdminChannelListDropdownProps) {
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  return (
    <Dropdown.Root open={dropdownIsOpen} onOpenChange={setDropdownIsOpen}>
      <Dropdown.Trigger asChild>
        <div
          className={cn(
            'default-focus flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-50',
            { 'bg-gray-50': dropdownIsOpen },
            { invisible: !parentIsHovered && !dropdownIsOpen }
          )}
        >
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
