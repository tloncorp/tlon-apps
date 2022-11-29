import * as Tooltip from '@radix-ui/react-tooltip';
import React, { PropsWithChildren } from 'react';
import ShipName from './ShipName';

type MigrationTooltipProps = PropsWithChildren<{
  ship: string;
  side: Tooltip.TooltipContentProps['side'];
}>;

export default function MigrationTooltip({
  side,
  ship,
  children,
}: MigrationTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={16} className="z-10">
          <div className="flex w-[200px] flex-col space-y-4 rounded-lg bg-white p-4 leading-5 drop-shadow-lg dark:border dark:border-solid dark:border-gray-50">
            <span>
              This channel will become available once{' '}
              <ShipName name={ship} className="font-semibold" /> has migrated.
            </span>
          </div>
          <Tooltip.Arrow asChild>
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
          </Tooltip.Arrow>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
