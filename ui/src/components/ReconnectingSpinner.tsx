import React from 'react';
import { useSubscriptionStatus } from '@/state/local';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

type Props = {
  className?: string;
};

export default function ReconnectingSpinner(
  props: React.HTMLAttributes<Props>
) {
  const { subscription } = useSubscriptionStatus();

  if (subscription === 'reconnecting')
    return (
      <div {...props}>
        <LoadingSpinner />
      </div>
    );

  return null;
}
