import cn from 'classnames';
import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ConnectionStatus } from '@/state/vitals';
import {
  getConnectionColor,
  getCompletedText,
  getPendingText,
} from '@/logic/utils';
import { Saga } from '@/types/groups';
import Bullet16Icon from '@/components/icons/Bullet16Icon';

interface HostConnectionProps {
  ship: string;
  saga: Saga | null;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text';
  className?: string;
}

function getText(saga: Saga | null, ship: string, status?: ConnectionStatus) {
  if (ship === window.our) {
    return 'You are the host';
  }

  if (saga && 'behind' in saga) {
    return 'Channel host requires an update';
  }

  if (saga && 'ahead' in saga) {
    return 'Your Groups app requires an update';
  }

  return !status
    ? 'No connection data'
    : 'pending' in status
    ? getPendingText(status, ship)
    : getCompletedText(status, ship);
}

function getHostConnectionColor(saga: Saga | null, status?: ConnectionStatus) {
  if (saga && !('synced' in saga)) {
    return 'text-red-400';
  }

  const color = getConnectionColor(status);
  return color === 'text-red-400' ? 'text-gray-400' : color;
}

export default function HostConnection({
  status,
  ship,
  type = 'default',
  saga,
  className,
}: HostConnectionProps) {
  return (
    <span className={cn('flex space-x-1 font-semibold', className)}>
      {type === 'default' && (
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={0}>
            <Tooltip.Trigger>
              <Bullet16Icon
                className={cn('h-4 w-4', getHostConnectionColor(saga, status))}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content asChild>
                <div className="pointer-events-none z-50 w-fit cursor-none rounded bg-gray-800 px-3 py-1 font-semibold text-white">
                  {getText(saga, ship, status)}
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
                        className="fill-gray-800"
                      />
                    </svg>
                  </Tooltip.Arrow>
                </div>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
      {type === 'combo' && (
        <Bullet16Icon
          className={cn('h-4 w-4', getHostConnectionColor(saga, status))}
        />
      )}
      {type !== 'default' && <span>{getText(saga, ship, status)}</span>}
    </span>
  );
}
