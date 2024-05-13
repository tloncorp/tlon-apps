import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';
import { Path, Svg } from 'react-native-svg';
import { useTheme } from 'tamagui';

export function ChatMessageDeliveryStatus({
  status,
}: {
  status: db.PostDeliveryStatus;
}) {
  const theme = useTheme();

  return (
    <Svg fill="none" viewBox="0 0 24 24" height="24" width="24">
      <Path
        d="M7 8L11 12L7 16"
        stroke={
          status === 'pending' ? theme.tertiaryText.val : theme.primaryText.val
        }
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 8L19 12L15 16"
        stroke={theme.tertiaryText.val}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
