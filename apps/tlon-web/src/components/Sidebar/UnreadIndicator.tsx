import cn from 'classnames';
import React from 'react';

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
