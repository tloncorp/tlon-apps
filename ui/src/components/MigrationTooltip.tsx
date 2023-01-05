import * as Popover from '@radix-ui/react-popover';
import { useGroupState } from '@/state/groups';
import React, { PropsWithChildren } from 'react';
import ShipName from './ShipName';

type MigrationTooltipProps = PropsWithChildren<{
  ship: string;
  side: Popover.PopoverContentProps['side'];
  flag?: string;
  kind?: 'group' | 'channel';
}>;

export default function MigrationTooltip({
  side,
  ship,
  flag,
  kind = 'channel',
  children,
}: MigrationTooltipProps) {
  const handleLeaveGroup = () => {
    if (flag) {
      useGroupState.getState().leave(flag);
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={side} sideOffset={16} className="z-10">
          <div className="flex w-[200px] flex-col space-y-4 rounded-lg bg-white p-4 leading-5 drop-shadow-lg dark:border dark:border-solid dark:border-gray-50">
            <span>
              This {kind} will become available once{' '}
              <ShipName name={ship} className="font-semibold" /> has migrated.
            </span>
            {kind === 'group' ? (
              <div className="flex items-center justify-between">
                <Popover.Close>
                  <button
                    className="small-button bg-gray-50 text-red"
                    onClick={handleLeaveGroup}
                  >
                    Leave Group
                  </button>
                </Popover.Close>
                <Popover.Close asChild>
                  <button className="small-button">OK</button>
                </Popover.Close>
              </div>
            ) : null}
          </div>
          <Popover.Arrow asChild>
            <svg
              width="17"
              height="8"
              viewBox="0 0 17 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                className="fill-white"
              />
            </svg>
          </Popover.Arrow>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
