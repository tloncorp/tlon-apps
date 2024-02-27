import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { DisplayMode } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';

import GridIcon from '@/components/icons/GridIcon';
import ListIcon from '@/components/icons/ListIcon';

interface DisplayDropdownProps {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

export default function DisplayDropdown({
  displayMode,
  setDisplayMode,
}: DisplayDropdownProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="flex h-6 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-50 ">
          {displayMode === 'grid' ? (
            <GridIcon className="h-6 w-6" />
          ) : (
            <ListIcon className="h-6 w-6" />
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            displayMode === 'list' && 'hover-bg-gray-100 bg-gray-100'
          )}
          onClick={() => setDisplayMode('list')}
        >
          List
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item',
            displayMode === 'grid' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => setDisplayMode('grid')}
        >
          Grid
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
