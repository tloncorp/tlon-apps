import useShipNames from '@/logic/useShipNames';
import * as Tooltip from '@radix-ui/react-tooltip';
import React from 'react';

export default function PendingIndicator({ hive }: { hive: string[] }) {
  const hiveNames = useShipNames({ ships: hive });
  return (
    <Tooltip.Root delayDuration={100} disableHoverableContent>
      <Tooltip.Portal>
        <Tooltip.Content asChild sideOffset={5} hideWhenDetached>
          <div className="pointer-events-none z-40 justify-items-center rounded">
            <div className="fit z-40 max-w-[10rem] cursor-none rounded bg-gray-400 px-4 py-2">
              <label className="break-words font-semibold text-white">
                {hiveNames}{' '}
              </label>
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
                  className="fill-gray-400"
                />
              </svg>
            </Tooltip.Arrow>
          </div>
        </Tooltip.Content>
      </Tooltip.Portal>
      <Tooltip.Trigger asChild>
        <span className="cursor-pointer text-blue"> {hive.length} Pending</span>
      </Tooltip.Trigger>
    </Tooltip.Root>
  );
}
