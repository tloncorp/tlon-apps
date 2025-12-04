import { Text } from '@tloncorp/ui';
import { useSelect } from 'react-cosmos/client';
import { YStack } from 'tamagui';

import { EmptyChannelNotice } from '../ui/components/Channel/EmptyChannelNotice';
import { FixtureWrapper } from './FixtureWrapper';
import { tlonLocalIntros } from './fakeData';

function EmptyChannelNoticeFixture() {
  const [state] = useSelect<'empty' | 'loading' | 'error'>('State', {
    defaultValue: 'empty',
    options: ['empty', 'loading', 'error'],
  });

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} padding="$l">
        <Text size="$label/m" color="$tertiaryText" marginBottom="$m">
          State: {state}
        </Text>
        <EmptyChannelNotice
          channel={tlonLocalIntros}
          userId="~zod"
          isLoading={state === 'loading'}
          loadPostsError={
            state === 'error' ? new Error('Network request failed') : null
          }
          onPressRetryLoad={() => console.log('Retry load')}
        />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Empty Channel Notice': <EmptyChannelNoticeFixture />,
};
