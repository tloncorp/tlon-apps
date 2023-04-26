import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import GridIcon from '@/components/icons/GridIcon';
import ListIcon from '@/components/icons/ListIcon';
import { HeapDisplayMode } from '@/types/heap';

interface DisplayDropdownProps {
  displayMode: HeapDisplayMode;
  setDisplayMode: (mode: HeapDisplayMode) => void;
}

export default function DisplayDropdown({
  displayMode,
  setDisplayMode,
}: DisplayDropdownProps) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-50 ">
          {displayMode === 'grid' ? (
            <GridIcon className="h-6 w-6 text-gray-400" />
          ) : (
            <ListIcon className="h-6 w-6 text-gray-400" />
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content className="dropdown">
        <Dropdown.Item
          className={cn(
            'dropdown-item-icon',
            displayMode === 'list' && 'hover-bg-gray-100 bg-gray-100'
          )}
          onClick={() => setDisplayMode('list')}
        >
          <div className="rounded bg-gray-50 p-1 mix-blend-multiply dark:mix-blend-screen">
            <ListIcon className="-m-1 h-8 w-8" />
          </div>
          <span className="font-semibold">List</span>
        </Dropdown.Item>
        <Dropdown.Item
          className={cn(
            'dropdown-item-icon',
            displayMode === 'grid' && 'bg-gray-100 hover:bg-gray-100'
          )}
          onClick={() => setDisplayMode('grid')}
        >
          <div className="rounded bg-gray-50 p-1 mix-blend-multiply dark:mix-blend-screen">
            <GridIcon className="-m-1 h-8 w-8" />
          </div>
          <span className="font-semibold">Grid</span>
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
