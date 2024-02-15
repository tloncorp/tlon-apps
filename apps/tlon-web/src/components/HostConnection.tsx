import Tooltip from '@/components/Tooltip';
import Bullet16Icon from '@/components/icons/Bullet16Icon';
import {
  getCompletedText,
  getConnectionColor,
  getPendingText,
  grayConnection,
  redConnection,
} from '@/logic/utils';
import { ConnectionStatus } from '@/state/vitals';
import cn from 'classnames';

export interface HostConnectionProps {
  ship: string;
  matched: boolean;
  status?: ConnectionStatus;
  type?: 'default' | 'combo' | 'text' | 'bullet' | 'row';
  className?: string;
}

export function getText(
  match: boolean,
  ship: string,
  status?: ConnectionStatus
) {
  if (ship === window.our) {
    return 'You are the host.';
  }

  if (!match) {
    return 'Your version of the app does not match the host.';
  }

  return !status
    ? 'No connection data'
    : 'pending' in status
      ? getPendingText(status, ship)
      : getCompletedText(status, ship);
}

function getHostConnectionColor(match: boolean, status?: ConnectionStatus) {
  if (!match) {
    return redConnection;
  }

  const color = getConnectionColor(status);
  return color.name === 'red' ? grayConnection : color;
}

export default function HostConnection({
  status,
  ship,
  type = 'default',
  matched,
  className,
}: HostConnectionProps) {
  const text = getText(matched, ship, status);
  const { dot, bar } = getHostConnectionColor(matched, status);

  return (
    <span className={cn('flex items-center space-x-1', className)}>
      {type === 'default' && (
        <Tooltip content={getText(matched, ship, status)}>
          <span tabIndex={0} className="default-focus rounded-md">
            <Bullet16Icon className={cn('h-4 w-4 flex-none', dot)} />
          </span>
        </Tooltip>
      )}
      {(type === 'combo' || type === 'bullet') && (
        <Bullet16Icon className={cn('h-4 w-4 flex-none', dot)} />
      )}
      {(type === 'combo' || type === 'text') && <span>{text}</span>}

      {type === 'row' && (
        <div
          className={cn(
            'h-full w-full rounded-xl border px-6 py-3 leading-6',
            bar
          )}
        >
          {text}
        </div>
      )}
    </span>
  );
}
