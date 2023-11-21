import cn from 'classnames';
import React from 'react';
import useNegotiation from '@/state/negotiation';
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
  type?: 'default' | 'combo' | 'text' | 'bullet';
  className?: string;
}

export default function ShipConnection({
  status,
  ship,
  type = 'default',
  className,
}: ShipConnectionProps) {
  const { match: negotiationMatch } = useNegotiation(ship, 'chat', 'chat');
  const isSelf = ship === window.our;
  const color = isSelf
    ? 'text-green-400'
    : negotiationMatch
    ? getConnectionColor(status)
    : 'text-red-400';
  const text = isSelf
    ? 'This is you'
    : !status
    ? 'No connection data'
    : 'pending' in status
    ? getPendingText(status, ship)
    : negotiationMatch
    ? getCompletedText(status, ship)
    : 'Your version does not match the other party';

  return (
    <span
      className={cn(
        'relative flex items-start space-x-1 font-semibold',
        className
      )}
    >
      {type === 'default' && (
        <Tooltip content={text}>
          <span tabIndex={0}>
            <Bullet16Icon className={cn('h-4 w-4 flex-none', color)} />
          </span>
        </Tooltip>
      )}
      {(type === 'combo' || type === 'bullet') && (
        <Bullet16Icon className={cn('h-4 w-4 flex-none', color)} />
      )}
      {(type === 'combo' || type === 'text') && <span>{text}</span>}
    </span>
  );
}
