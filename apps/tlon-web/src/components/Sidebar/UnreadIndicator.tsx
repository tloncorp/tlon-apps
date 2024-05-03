import cn from 'classnames';

import ActivityIndicator from './ActivityIndicator';

interface UnreadIndicatorProps {
  className?: string;
  count?: number;
  notify?: boolean;
}

export default function UnreadIndicator({
  className,
  count,
  notify,
}: UnreadIndicatorProps) {
  const color = notify ? 'text-blue' : 'text-gray-400';
  return (
    <ActivityIndicator
      count={count || 0}
      bg={'transparent'}
      className={cn(color, className)}
    />
  );
}
