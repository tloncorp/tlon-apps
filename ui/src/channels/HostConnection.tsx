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
import { useNegotiate } from '@/state/negotiation';

interface HostConnectionProps {
  ship: string;
  saga: Saga | null;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text' | 'bullet' | 'row';
  className?: string;
}

export function getText(
  saga: Saga | null,
  ship: string,
  status?: ConnectionStatus,
  negotiationMatch?: boolean
) {
  if (ship === window.our) {
    return 'You are the host.';
  }

  if (saga && !('synced' in saga)) {
    return getCompatibilityText(saga);
  }

  if (negotiationMatch === false) {
    return 'Your version of Tlon does not match the host.';
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
    return 'red';
  }

  if (negotiationMatch === false) {
    return 'red';
  }

  const color = getConnectionColor(status);
  return color === 'red' ? 'gray' : color;
}

export default function HostConnection({
  status,
  ship,
  type = 'default',
  saga,
  className,
}: HostConnectionProps) {
  const { status: negotiationStatus } = useNegotiate(
    ship,
    'channels',
    'channels-server'
  );

  const matched = negotiationStatus === 'match';

  return (
    <span className={cn('flex items-center space-x-1', className)}>
      {type === 'default' && (
        <Tooltip content={getText(saga, ship, status, matched)}>
          <span tabIndex={0} className="default-focus rounded-md">
            <Bullet16Icon
              className={cn(
                'h-4 w-4 flex-none',
                `text-${getHostConnectionColor(saga, status, matched)}-400`
              )}
            />
          </span>
        </Tooltip>
      )}
      {(type === 'combo' || type === 'bullet') && (
        <Bullet16Icon
          className={cn(
            'h-4 w-4 flex-none',
            `text-${getHostConnectionColor(saga, status, matched)}-400`
          )}
        />
      )}
      {(type === 'combo' || type === 'text') && (
        <span>{getText(saga, ship, status, matched)}</span>
      )}

      {type === 'row' && (
        <div
          className={cn(
            'h-full w-full rounded-xl px-6 py-4 leading-6',
            `text-${getHostConnectionColor(saga, status, matched)}-500`,
            `bg-${getHostConnectionColor(saga, status, matched)}-50`
          )}
        >
          {getText(saga, ship, status, matched)}
        </div>
      )}
    </span>
  );
}
