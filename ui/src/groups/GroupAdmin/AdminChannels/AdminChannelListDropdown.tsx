import React from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useRouteGroup, useGroupState } from '@/state/groups';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import CheckIcon from '@/components/icons/CheckIcon';

interface AdminChannelListDropdownProps {
  channelFlag: string;
}

type DropdownOptions = { [key: string]: string };

export default function AdminChannelListDropdown({
  channelFlag,
}: AdminChannelListDropdownProps) {
  const groupFlag = useRouteGroup();
  const dropdownValues: DropdownOptions = {
    all: 'Open To All',
    'read-only': 'Member Can View',
    'admin-only': 'Admin Only',
  };
  const [permission, setPermission] = React.useState('all');

  const updatePerms = (value: string) => {
    const newSects = [];
    if (value === 'admin-only') {
      newSects.push('admin');
    }
    useGroupState.getState().setChannelPerm(groupFlag, channelFlag, newSects);
    setPermission(value);
  };

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <div className="default-focus flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-50">
          {dropdownValues[permission]}
          <CaretDown16Icon className="ml-2 h-4 w-4" />
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.RadioGroup value={permission} onValueChange={updatePerms}>
          <Dropdown.RadioItem
            value="all"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            {dropdownValues.all}
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
          <Dropdown.RadioItem
            value="read-only"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            {dropdownValues['read-only']}
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5 fill-gray-600" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
          <Dropdown.RadioItem
            value="admin-only"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            {dropdownValues['admin-only']}
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
        </Dropdown.RadioGroup>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
