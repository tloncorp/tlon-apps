import { ColorTokens } from 'tamagui';

import { Spinner } from '../core';

// This will render a system spinner on mobile. We have an existing implementation of our
// custom spinner from the old mobile repo, but it needs to be refactored to use our new style
// tooling (apps/tlon-mobile/src/components/LoadingSpinner.tsx)
export function LoadingSpinner({
  size,
  color,
}: {
  size?: 'large' | 'small';
  color?: ColorTokens;
}) {
  return <Spinner size={size} color={color ?? '$color.gray700'} />;
}
