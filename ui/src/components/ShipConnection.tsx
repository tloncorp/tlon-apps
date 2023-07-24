import cn from 'classnames';
import React from 'react';
import { ConnectionStatus } from '../state/vitals';
import {
  getConnectionColor,
  getCompletedText,
  getPendingText,
} from '../logic/utils';
import Bullet16Icon from './icons/Bullet16Icon';
import Tooltip from './Tooltip';

interface ShipConnectionProps {
  ship: string;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text';
  className?: string;
}

export default function ShipConnection({
  status,
  ship,
  type = 'default',
  className,
}: ShipConnectionProps) {
  const isSelf = ship === window.our;
  const color = isSelf ? 'text-green-400' : getConnectionColor(status);
  const text = isSelf
    ? 'This is you'
    : !status
    ? 'No connection data'
    : 'pending' in status
    ? getPendingText(status, ship)
    : getCompletedText(status, ship);

  return (
    <span className={cn('flex items-start space-x-1 font-semibold', className)}>
      {type === 'default' && (
        <Tooltip content={text}>
          <Bullet16Icon
            className={cn('h-4 w-4 flex-none', color)}
            tabIndex={0}
          />
        </Tooltip>
      )}
      {type === 'combo' && (
        <Bullet16Icon className={cn('h-4 w-4 flex-none', color)} />
      )}
      {type !== 'default' && <span>{text}</span>}
    </span>
  );
}
