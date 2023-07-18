import cn from 'classnames';
import React from 'react';
import { ConnectionStatus } from '../state/vitals';
import {
  getConnectionColor,
  getCompletedText,
  getPendingText,
} from '../logic/utils';
import Bullet16Icon from './icons/Bullet16Icon';

interface ShipConnectionProps {
  ship: string;
  status?: ConnectionStatus;
  showBullet?: boolean;
  showText?: boolean;
  className?: string;
}

export default function ShipConnection({
  status,
  ship,
  showBullet = true,
  showText = true,
  className,
}: ShipConnectionProps) {
  return (
    <span
      title={
        !status
          ? 'No connection data'
          : 'pending' in status
          ? getPendingText(status, ship)
          : getCompletedText(status, ship)
      }
      className={cn('flex space-x-1 font-semibold', className)}
    >
      {showBullet && (
        <Bullet16Icon className={cn('h-4 w-4', getConnectionColor(status))} />
      )}{' '}
      {showText && (
        <span>
          {!status
            ? 'No connection data'
            : 'pending' in status
            ? getPendingText(status, ship)
            : getCompletedText(status, ship)}
        </span>
      )}
    </span>
  );
}
