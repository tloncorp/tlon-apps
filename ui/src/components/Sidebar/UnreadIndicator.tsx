import React from 'react';
import ActivityIndicator from './ActivityIndicator';

export default function UnreadIndicator({
  className,
  count,
}: {
  className?: string;
  count?: number;
}) {
  return <ActivityIndicator count={count || 0} className={className} />;
}
