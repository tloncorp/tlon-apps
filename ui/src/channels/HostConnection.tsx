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
import useNegotiation from '@/state/negotiation';

interface HostConnectionProps {
  ship: string;
  saga: Saga | null;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text' | 'bullet';
  className?: string;
}

export function getText(
  saga: Saga | null,
  ship: string,
  status?: ConnectionStatus,
  negotiationMatch?: boolean
) {
  if (ship === window.our) {
    return 'You are the host';
  }

  if (saga && !('synced' in saga)) {
    return getCompatibilityText(saga);
  }

  if (negotiationMatch === false) {
    return "Your version of groups does not match the host's";
  }

  return !status
    ? 'No connection data'
    : 'pending' in status
    ? getPendingText(status, ship)
    : getCompletedText(status, ship);
}

function getHostConnectionColor(
  saga: Saga | null,
  status?: ConnectionStatus,
  negotiationMatch?: boolean
) {
  if (saga && !('synced' in saga)) {
    return 'text-red-400';
  }

  if (negotiationMatch === false) {
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
  const negotiationMatch = useNegotiation(ship, 'channels', 'channels-server');

  return (
    <span className={cn('flex items-center space-x-1', className)}>
      {type === 'default' && (
        <Tooltip content={getText(saga, ship, status, negotiationMatch)}>
          <span tabIndex={0} className="default-focus rounded-md">
            <Bullet16Icon
              className={cn(
                'h-4 w-4 flex-none',
                getHostConnectionColor(saga, status, negotiationMatch)
              )}
            />
          </span>
        </Tooltip>
      )}
      {(type === 'combo' || type === 'bullet') && (
        <Bullet16Icon
          className={cn(
            'h-4 w-4 flex-none',
            getHostConnectionColor(saga, status, negotiationMatch)
          )}
        />
      )}
      {(type === 'combo' || type === 'text') && (
        <span>{getText(saga, ship, status, negotiationMatch)}</span>
      )}
    </span>
  );
}
