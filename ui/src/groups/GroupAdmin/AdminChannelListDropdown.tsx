import React from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import CaretDown16Icon from '../../components/icons/CaretDown16Icon';
import CheckIcon from '../../components/icons/CheckIcon';

export default function AdminChannelListDropdown() {
  const [permission, setPermission] = React.useState('Open To All');
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <div className="default-focus flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-50">
          {permission}
          <CaretDown16Icon className="ml-2 h-4 w-4" />
        </div>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.RadioGroup value={permission} onValueChange={setPermission}>
          <Dropdown.RadioItem
            value="Open To All"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            Open To All
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
          <Dropdown.RadioItem
            value="Member Can View"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            Member Can View
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5 fill-gray-600" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
          <Dropdown.RadioItem
            value="Admin Only"
            className="dropdown-item flex items-center justify-between space-x-2"
          >
            Admin Only
            <Dropdown.ItemIndicator>
              <CheckIcon className="h-5 w-5" />
            </Dropdown.ItemIndicator>
          </Dropdown.RadioItem>
        </Dropdown.RadioGroup>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
