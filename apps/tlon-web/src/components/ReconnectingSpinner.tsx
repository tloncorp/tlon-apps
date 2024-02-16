import React from 'react';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useSubscriptionStatus } from '@/state/local';

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
