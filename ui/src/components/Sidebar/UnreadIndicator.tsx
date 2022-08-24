import React from 'react';
import cn from 'classnames';

import ActivityIndicator from './ActivityIndicator';

export default function UnreadIndicator({ className }: { className?: string }) {
  return (
    <ActivityIndicator
      count={0}
      bg={'transparent'}
      className={cn('text-blue', className)}
    />
  );
}
