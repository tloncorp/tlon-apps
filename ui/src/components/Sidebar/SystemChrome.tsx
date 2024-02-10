import cn from 'classnames';
import GridIcon from '../icons/GridIcon';
import useLeap from '../Leap/useLeap';

export default function SystemChrome() {
  const metaKey = navigator.userAgent.toLowerCase().includes('mac')
    ? '⌘'
    : 'Ctrl';
  const { setIsOpen } = useLeap();
  return (
    <button
      onClick={() => setIsOpen((isOpen) => !isOpen)}
      className="flex w-full cursor-pointer flex-row space-x-2 px-1 text-gray-400 hover:text-gray-800"
    >
      <div className="flex flex-row items-center space-x-2">
        <GridIcon className="h-8 w-8" />
        <span className="font-semibold">Leap</span>
        <span>({metaKey} + K)</span>
      </div>
    </button>
  );
}

export function LeapShortcutIcon({ className }: { className?: string }) {
  const metaKey = navigator.userAgent.toLowerCase().includes('mac')
    ? '⌘'
    : 'Ctrl';
  const { setIsOpen } = useLeap();
  return (
    <button
      onClick={() => setIsOpen((isOpen) => !isOpen)}
      className={cn(
        'flex w-full cursor-pointer flex-row space-x-2 text-gray-400 hover:text-gray-800',
        className
      )}
    >
      <div className="flex flex-row items-center space-x-2">
        <span className="font-semibold">Leap</span>
        <span>({metaKey} + K)</span>
      </div>
    </button>
  );
}
