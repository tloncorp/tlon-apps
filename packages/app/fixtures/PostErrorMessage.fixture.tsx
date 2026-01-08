import { Text } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import { PostErrorMessage } from '../ui/components/PostErrorMessage';
import { FixtureWrapper } from './FixtureWrapper';

export default function PostErrorMessageFixture() {
  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$3xl">
        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            Basic Error Message
          </Text>
          <PostErrorMessage message="Something went wrong" />
        </YStack>

        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            Error with Action Button
          </Text>
          <PostErrorMessage
            message="Failed to load content"
            actionLabel="Retry"
            onAction={() => console.log('Retry clicked')}
          />
        </YStack>

        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            Network Error
          </Text>
          <PostErrorMessage
            message="Network connection lost"
            actionLabel="Try again"
            onAction={() => console.log('Try again clicked')}
          />
        </YStack>

        <YStack gap="$m">
          <Text size="$label/l" color="$secondaryText">
            Post Not Found
          </Text>
          <PostErrorMessage
            message="This post could not be found"
            actionLabel="Go back"
            onAction={() => console.log('Go back clicked')}
          />
        </YStack>
      </YStack>
    </FixtureWrapper>
  );
}
