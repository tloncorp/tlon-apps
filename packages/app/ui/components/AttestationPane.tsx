import { makePrettyDay } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { XStack, XStackProps, YStack, styled } from 'tamagui';

import { useStore } from '../contexts';
import { PrimaryButton } from './Buttons';

export function AttestationPane({
  attestation,
  currentUserId,
}: {
  attestation: db.Verification;
  currentUserId: string;
}) {
  const [haveCheckedSig, setHaveCheckedSig] = useState(false);
  const [sigIsLoading, setSigIsLoading] = useState(true);
  const [sigIsValid, setSigIsValid] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const store = useStore();

  const formattedValue = useMemo(() => {
    if (attestation.type === 'twitter') {
      return `@${attestation.value}`;
    }

    return attestation.value;
  }, [attestation]);

  useEffect(() => {
    async function run() {
      if (
        attestation.contactId === currentUserId &&
        attestation.status === 'verified'
      ) {
        // trust our own attestations
        return;
      }
      try {
        if (attestation.signature && !haveCheckedSig) {
          setSigIsLoading(true);
          setHaveCheckedSig(true);
          setError(null);
          const isValid = await store.checkAttestedSignature(
            attestation.signature
          );
          setSigIsValid(isValid);
        }
      } catch (e) {
        setError(e);
      } finally {
        setSigIsLoading(false);
      }
    }
    run();
  }, [
    attestation.contactId,
    attestation.signature,
    attestation.status,
    currentUserId,
    haveCheckedSig,
    store,
  ]);

  const handleViewTweet = useCallback(() => {
    Linking.openURL(
      `https://x.com/${attestation.value!}/status/${attestation.provingTweetId}`
    );
  }, [attestation.provingTweetId, attestation.value]);

  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      await store.revokeAttestation(attestation);
    } finally {
      setRevoking(false);
    }
  }, [attestation, store]);

  const status: 'loading' | 'verified' | 'invalid' | 'errored' = useMemo(() => {
    if (
      attestation.contactId === currentUserId &&
      attestation.status === 'verified'
    ) {
      return 'verified';
    }

    if (sigIsLoading) return 'loading';
    if (error) return 'errored';
    if (sigIsValid) return 'verified';
    if (!sigIsLoading && haveCheckedSig && !sigIsValid) return 'invalid';

    return 'loading';
  }, [
    attestation.contactId,
    attestation.status,
    currentUserId,
    error,
    haveCheckedSig,
    sigIsLoading,
    sigIsValid,
  ]);

  const handleRetry = useCallback(() => {
    if (status === 'errored') {
      setHaveCheckedSig(false);
    }
  }, [status]);

  return (
    <YStack paddingHorizontal="$2xl" gap="$xl">
      <ItemContainer height={108}>
        <Text size="$label/xl" fontWeight="600">
          {formattedValue}
        </Text>
      </ItemContainer>

      <AttestationStatusWidget state={status} handleRetry={handleRetry} />

      <ItemContainer>
        <YStack gap="$xl" width="100%" alignItems="flex-start">
          <Text size="$label/m" color="$secondaryText">
            Verified by
          </Text>
          <Text size="$label/l">Tlon Corp</Text>
        </YStack>
      </ItemContainer>

      {attestation.initiatedAt && (
        <ItemContainer>
          <YStack gap="$xl" width="100%" alignItems="flex-start">
            <Text size="$label/m" color="$secondaryText">
              Verified on
            </Text>
            <Text size="$label/l">
              {makePrettyDay(new Date(attestation.initiatedAt))}
            </Text>
          </YStack>
        </ItemContainer>
      )}

      <YStack marginTop="$xl" gap="$m">
        {attestation.type === 'twitter' && attestation.provingTweetId && (
          <Button hero onPress={handleViewTweet}>
            <Button.Text fontWeight="500">View 𝕏 Post</Button.Text>
          </Button>
        )}

        {attestation.contactId === currentUserId && (
          <PrimaryButton
            onPress={handleRevoke}
            loading={revoking}
            disabled={revoking}
            backgroundColor="$negativeBackground"
            textColor="$negativeActionText"
            borderColor="$negativeBorder"
            disabledStyle={{ backgroundColor: '$negativeBackground' }}
          >
            Revoke
          </PrimaryButton>
        )}
      </YStack>
    </YStack>
  );
}

const ItemContainer = styled(XStack, {
  name: 'AttestationStatusContainer',
  padding: '$2xl',
  borderRadius: '$l',
  borderWidth: 1,
  borderColor: '$border',
  justifyContent: 'center',
  alignItems: 'center',
});

function AttestationStatusWidget({
  state,
  handleRetry,
  ...rest
}: {
  state: 'loading' | 'verified' | 'invalid' | 'errored';
  handleRetry?: () => void;
} & XStackProps) {
  const height = 90;

  if (state === 'verified') {
    return (
      <ItemContainer height={height} backgroundColor="$positiveBackground">
        <Icon
          type="VerifiedBadge"
          color="$positiveActionText"
          customSize={[40, 40]}
        />
        <Text size="$label/l" color="$positiveActionText">
          Verified
        </Text>
      </ItemContainer>
    );
  }

  if (state === 'errored') {
    return (
      <ItemContainer
        height={height}
        onPress={handleRetry}
        backgroundColor="$negativeBackground"
      >
        <YStack alignItems="center" gap="$m">
          <Text size="$label/l" color="$negativeActionText">
            Could not Verify
          </Text>
          <Text size="$label/m" color="$secondaryText">
            Tap to retry
          </Text>
        </YStack>
      </ItemContainer>
    );
  }

  if (state === 'invalid') {
    return (
      <ItemContainer
        height={height}
        onPress={handleRetry}
        backgroundColor="$negativeBackground"
      >
        <YStack alignItems="center" gap="$l">
          <Text size="$label/l" color="$negativeActionText">
            Invalid
          </Text>
          <Text size="$label/m" color="$secondaryText">
            Signature is incorrect or revoked
          </Text>
        </YStack>
      </ItemContainer>
    );
  }

  return (
    <ItemContainer
      height={height}
      {...rest}
      backgroundColor="$secondaryBackground"
      gap="$m"
    >
      <LoadingSpinner />
      <Text size="$label/l">Loading</Text>
    </ItemContainer>
  );
}
