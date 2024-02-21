import cn from 'classnames';

import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import CheckIcon from './icons/CheckIcon';

export default function SpinToggle({
  enabled,
  loading,
  onClick,
}: {
  enabled: boolean;
  loading: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center">
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full',
          enabled ? 'bg-blue dark:bg-blue-soft' : 'bg-gray-200'
        )}
      >
        {loading ? (
          <LoadingSpinner
            className="h-4 w-4"
            secondary={'fill-gray-100 dark:fill-gray-200'}
          />
        ) : enabled ? (
          <CheckIcon className="h-4 w-4 text-white dark:text-black" />
        ) : null}
      </div>
    </div>
  );
}
