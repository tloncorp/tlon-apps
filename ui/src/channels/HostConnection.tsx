import cn from 'classnames';
import React from 'react';
import { ConnectionStatus } from '@/state/vitals';
import {
  getConnectionColor,
  getCompletedText,
  getPendingText,
  getCompatibilityText,
} from '@/logic/utils';
import { Saga } from '@/types/groups';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import Tooltip from '@/components/Tooltip';

interface HostConnectionProps {
  ship: string;
  saga: Saga | null;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text';
  className?: string;
}

export function getText(
  saga: Saga | null,
  ship: string,
  status?: ConnectionStatus
) {
  if (ship === window.our) {
    return 'You are the host';
  }

  if (saga && !('synced' in saga)) {
    return getCompatibilityText(saga);
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
    <span className={cn('flex items-start space-x-1 font-semibold', className)}>
      {type === 'default' && (
        <Tooltip content={getText(saga, ship, status)}>
          <span tabIndex={0}>
            <Bullet16Icon
              className={cn(
                'h-4 w-4 flex-none',
                getHostConnectionColor(saga, status)
              )}
            />
          </span>
        </Tooltip>
      )}
      {type === 'combo' && (
        <Bullet16Icon
          className={cn(
            'h-4 w-4 flex-none',
            getHostConnectionColor(saga, status)
          )}
        />
      )}
      {type !== 'default' && <span>{getText(saga, ship, status)}</span>}
    </span>
  );
}
