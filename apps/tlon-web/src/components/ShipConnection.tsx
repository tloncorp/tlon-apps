import { useNegotiate } from '@/state/negotiation';
import cn from 'classnames';

import {
  getCompletedText,
  getConnectionColor,
  getPendingText,
} from '../logic/utils';
import { ConnectionStatus } from '../state/vitals';
import Tooltip from './Tooltip';
import Bullet16Icon from './icons/Bullet16Icon';

interface ShipConnectionProps {
  ship: string;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text' | 'bullet';
  className?: string;
  app?: 'chat' | 'channels';
  agent?: 'chat' | 'channels-server';
}

export default function ShipConnection({
  status,
  ship,
  type = 'default',
  className,
  app = 'chat',
  agent = 'chat',
}: ShipConnectionProps) {
  const { matchedOrPending } = useNegotiate(ship, app, agent);

  const isSelf = ship === window.our;
  const color = isSelf
    ? 'text-green-400'
    : matchedOrPending
      ? getConnectionColor(status).dot
      : 'text-red-400';
  const text = isSelf
    ? 'This is you'
    : !status
      ? 'No connection data'
      : 'pending' in status
        ? getPendingText(status, ship)
        : matchedOrPending
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
