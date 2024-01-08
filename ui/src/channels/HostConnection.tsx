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
import { get } from 'lodash';

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
                getHostConnectionColor(saga, status, matched) === 'red' &&
                  'text-red-400',
                getHostConnectionColor(saga, status, matched) === 'yellow' &&
                  'text-yellow-400',
                getHostConnectionColor(saga, status, matched) === 'green' &&
                  'text-green-400',
                getHostConnectionColor(saga, status, matched) === 'gray' &&
                  'text-gray-400'
              )}
            />
          </span>
        </Tooltip>
      )}
      {(type === 'combo' || type === 'bullet') && (
        <Bullet16Icon
          className={cn(
            'h-4 w-4 flex-none',
            getHostConnectionColor(saga, status, matched) === 'red' &&
              'text-red-400',
            getHostConnectionColor(saga, status, matched) === 'yellow' &&
              'text-yellow-400',
            getHostConnectionColor(saga, status, matched) === 'green' &&
              'text-green-400',
            getHostConnectionColor(saga, status, matched) === 'gray' &&
              'text-gray-400'
          )}
        />
      )}
      {(type === 'combo' || type === 'text') && (
        <span>{getText(saga, ship, status, matched)}</span>
      )}

      {type === 'row' && (
        <div
          className={cn(
            'h-full w-full rounded-xl border px-6 py-3 leading-6',
            getHostConnectionColor(saga, status, matched) === 'red' &&
              'border-red-400 bg-red-50 text-red-500',
            getHostConnectionColor(saga, status, matched) === 'yellow' &&
              'border-yellow-400 bg-yellow-50 text-yellow-500',
            getHostConnectionColor(saga, status, matched) === 'green' &&
              'border-green-200 bg-green-50 text-green-500',
            getHostConnectionColor(saga, status, matched) === 'gray' &&
              'border-gray-400 bg-gray-50 text-gray-500'
          )}
        >
          {getText(saga, ship, status, matched)}
        </div>
      )}
    </span>
  );
}
