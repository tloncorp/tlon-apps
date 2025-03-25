import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AttestationSheet } from '../AttestationSheet';
import { WidgetPane } from '../WidgetPane';

export function ConnectedAccountsWidget(props: {
  twitterAttest?: db.Verification;
  phoneAttest?: db.Verification;
}) {
  const [selectedAttest, setSelectedAttest] = useState<db.Verification | null>(
    null
  );

  const handleViewTweet = useCallback(() => {
    if (props.twitterAttest && props.twitterAttest.value) {
      Linking.openURL(`https://x.com/${props.twitterAttest.value}`);
    }
  }, [props.twitterAttest]);

  if (!props.twitterAttest && !props.phoneAttest) {
    return null;
  }

  return (
    <WidgetPane width="100%">
      <WidgetPane.Title>Connected Accounts</WidgetPane.Title>
      <YStack gap="$l">
        {props.twitterAttest && props.twitterAttest.value && (
          <Pressable
            onPress={handleViewTweet}
            onLongPress={() => setSelectedAttest(props.twitterAttest!)}
          >
            <YStack
              alignItems="flex-start"
              gap="$m"
              padding="$2xl"
              borderRadius="$l"
              backgroundColor="$secondaryBackground"
            >
              <XStack justifyContent="space-between">
                <XStack alignItems="center" gap="$m">
                  <Icon type="VerifiedBadge" customSize={[28, 28]} />
                  <Text size="$label/l" color="$secondaryText" fontWeight="500">
                    @{props.twitterAttest.value}
                  </Text>
                </XStack>
              </XStack>
            </YStack>
          </Pressable>
        )}
        {props.phoneAttest && (
          <Pressable onLongPress={() => setSelectedAttest(props.phoneAttest!)}>
            <XStack
              alignItems="center"
              gap="$l"
              padding="$2xl"
              borderRadius="$l"
              backgroundColor="$secondaryBackground"
            >
              <Icon type="VerifiedBadge" customSize={[28, 28]} />
              <Text size="$label/l" color="$secondaryText" fontWeight="500">
                Phone number
              </Text>
            </XStack>
          </Pressable>
        )}
      </YStack>
      <AttestationSheet
        open={selectedAttest !== null}
        onOpenChange={() => setSelectedAttest(null)}
        attestation={selectedAttest}
      />
    </WidgetPane>
  );
}
