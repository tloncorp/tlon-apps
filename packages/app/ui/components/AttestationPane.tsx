import * as db from '@tloncorp/shared/db';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { Circle, XStack, YStack } from 'tamagui';

import { useStore } from '../contexts';

export function AttestationPane({
  attestation,
  currentUserId,
}: {
  attestation: db.Verification;
  currentUserId: string;
}) {
  const store = useStore();

  const formattedValue = useMemo(() => {
    if (attestation.type === 'twitter') {
      return `@${attestation.value}`;
    }

    return attestation.value;
  }, [attestation]);

  const handleViewTweet = useCallback(() => {
    Linking.openURL(
      `https://x.com/${attestation.value!}/status/${attestation.provingTweetId}`
    );
  }, [attestation.provingTweetId, attestation.value]);

  const handleViewOnProvider = useCallback(() => {
    // TODO
  }, []);

  const handleRevoke = useCallback(() => {
    // TODO
  }, []);

  return (
    <YStack paddingHorizontal="$2xl">
      <XStack justifyContent="center" alignItems="center" gap="$m">
        <YStack>
          {/* <Text size="$label/m" color="$positiveActionText">
            Verified
          </Text> */}
          <Text size="$label/xl" fontWeight="600">
            {formattedValue}
          </Text>
        </YStack>
      </XStack>
      <XStack
        justifyContent="center"
        alignItems="center"
        gap="$m"
        width="100%"
        backgroundColor="$positiveBackground"
        padding="$m"
        marginVertical="$l"
        borderRadius="$m"
      >
        <Circle backgroundColor="$positiveBackground">
          <Icon type="Checkmark" color="$positiveActionText" />
        </Circle>
        <Text size="$label/l" color="$positiveActionText">
          Verified
        </Text>
      </XStack>
      <XStack justifyContent="space-between">
        <Text>Verified by</Text>
        <Text>Tlon Corp</Text>
      </XStack>
      <XStack justifyContent="space-between">
        <Text>Verified at</Text>
        <Text>March 12, 2025</Text>
      </XStack>

      <YStack marginTop="$6xl" gap="$m">
        {attestation.type === 'twitter' && attestation.provingTweetId && (
          <Button hero onPress={handleViewTweet}>
            <Button.Text>View Tweet</Button.Text>
          </Button>
        )}

        {/* <Button secondary backgroundColor="$secondaryBackground">
          <Button.Text>View on Tlon Verifier</Button.Text>
        </Button> */}

        {attestation.contactId === currentUserId && (
          <Button
            secondary
            backgroundColor="$negativeBackground"
            onPress={handleRevoke}
          >
            <Button.Text color="$negativeActionText">Revoke</Button.Text>
          </Button>
        )}
      </YStack>
    </YStack>
  );
}
