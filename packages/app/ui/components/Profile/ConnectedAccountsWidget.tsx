import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AttestationSheet } from '../AttestationSheet';
import { WidgetPane } from '../WidgetPane';

export function TwitterAttestDisplay(props: { attestation: db.Verification }) {
  const [showDetails, setShowDetails] = useState(false);
  const formattedHandle = useMemo(() => {
    if (props.attestation.value?.charAt(0) === '@') {
      return props.attestation.value;
    }
    return `@${props.attestation.value}`;
  }, [props.attestation.value]);

  const handleViewTweet = useCallback(() => {
    if (props.attestation && props.attestation.value) {
      Linking.openURL(`https://x.com/${props.attestation.value}`);
    }
  }, [props.attestation]);

  if (!props.attestation.value || props.attestation.type !== 'twitter') {
    return null;
  }

  return (
    <>
      <Pressable
        onPress={handleViewTweet}
        onLongPress={() => setShowDetails(true)}
        flex={1}
      >
        <WidgetPane flex={1}>
          <WidgetPane.Title>𝕏 Account</WidgetPane.Title>
          <YStack flex={1} justifyContent="center">
            <XStack alignItems="center" gap="$xs">
              <Text size="$label/l">{formattedHandle}</Text>
              <Icon type="VerifiedBadge" customSize={[24, 24]} />
            </XStack>
          </YStack>
        </WidgetPane>
      </Pressable>
      <AttestationSheet
        open={showDetails}
        onOpenChange={() => setShowDetails(false)}
        attestation={props.attestation}
      />
    </>
  );
}

export function PhoneAttestDisplay(props: { attestation: db.Verification }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!props.attestation.value || props.attestation.type !== 'phone') {
    return null;
  }

  return (
    <>
      <Pressable onLongPress={() => setShowDetails(true)} flex={1}>
        <WidgetPane flex={1}>
          <WidgetPane.Title>Phone</WidgetPane.Title>
          <YStack flex={1} justifyContent="center">
            <XStack alignItems="center" gap="$xs">
              <Text size="$label/l" fontWeight="500">
                (
                <Text size="$label/xl" fontWeight="600">
                  ···
                </Text>
                ){' '}
                <Text size="$label/xl" fontWeight="600">
                  ··· ····
                </Text>
              </Text>
              <Icon type="VerifiedBadge" customSize={[24, 24]} />
            </XStack>
          </YStack>
        </WidgetPane>
      </Pressable>
      <AttestationSheet
        open={showDetails}
        onOpenChange={() => setShowDetails(false)}
        attestation={props.attestation}
      />
    </>
  );
}
