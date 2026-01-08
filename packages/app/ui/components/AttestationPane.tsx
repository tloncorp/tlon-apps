import { makePrettyDay } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import {
  Button,
  Icon,
  LoadingSpinner,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Linking } from 'react-native';
import { XStack, XStackProps, YStack, styled } from 'tamagui';

import { useStore } from '../contexts';
import { HiddenPhoneDisplay } from './Profile/ConnectedAccountsWidget';

type SigStatus = 'initial' | 'loading' | 'verified' | 'invalid' | 'errored';

export function AttestationPane({
  attestation,
  currentUserId,
}: {
  attestation: db.Attestation;
  currentUserId: string;
}) {
  const [revoking, setRevoking] = useState(false);
  const [sigStatus, setSigStatus] = useState<SigStatus>('initial');
  const [error, setError] = useState<Error | null>(null);
  const store = useStore();

  useEffect(() => {
    async function run() {
      if (
        attestation.contactId === currentUserId &&
        attestation.status === 'verified'
      ) {
        // trust our own attestations
        setSigStatus('verified');
        return;
      }

      try {
        setSigStatus('loading');
        setError(null);
        if (!attestation.signature) {
          setSigStatus('errored');
          setError(new Error('Attestation signature missing.'));
          return;
        }

        const isValid = await store.checkAttestedSignature(
          attestation.signature
        );

        if (!isValid) {
          setSigStatus('invalid');
          return;
        }

        setSigStatus('verified');
      } catch (e) {
        setSigStatus('errored');
        setError(new Error('Could not verify signature. Please try again.'));
      }
    }

    if (sigStatus === 'initial') {
      run();
    }
  }, [
    attestation.contactId,
    attestation.signature,
    attestation.status,
    currentUserId,
    sigStatus,
    store,
  ]);

  const handleViewTweet = useCallback(() => {
    Linking.openURL(
      `https://x.com/${attestation.value!}/status/${attestation.provingTweetId}`
    );
  }, [attestation.provingTweetId, attestation.value]);

  const handleViewAccount = useCallback(() => {
    Linking.openURL(`https://x.com/${attestation.value}`);
  }, [attestation.value]);

  const handleRevoke = useCallback(async () => {
    setRevoking(true);
    try {
      await store.revokeAttestation(attestation);
    } finally {
      setRevoking(false);
    }
  }, [attestation, store]);

  const handleRetry = useCallback(() => {
    if (sigStatus === 'errored') {
      setSigStatus('initial');
    }
  }, [sigStatus]);

  return (
    <YStack paddingHorizontal="$2xl" gap="$xl">
      <ItemContainer height={108}>
        <AttestationValueDisplay
          attestation={attestation}
          currentUserId={currentUserId}
        />
      </ItemContainer>

      <AttestationStatusWidget status={sigStatus} handleRetry={handleRetry} />

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
          <>
            <Button fill="outline" type="primary" onPress={handleViewTweet} label="View 𝕏 Post" centered />
            <Button fill="solid" type="primary" onPress={handleViewAccount} label="View 𝕏 Account" centered />
          </>
        )}

        {attestation.contactId === currentUserId && (
          <Button
            onPress={handleRevoke}
            loading={revoking}
            disabled={revoking}
            type="negative"
            label="Revoke"
            centered
          />
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
  status,
  handleRetry,
  ...rest
}: {
  status: SigStatus;
  handleRetry?: () => void;
} & XStackProps) {
  const height = 90;

  const isWindowNarrow = useIsWindowNarrow();
  const retryVerb = useMemo(() => {
    if (isWindowNarrow) {
      return 'Tap';
    } else {
      return 'Click';
    }
  }, [isWindowNarrow]);

  if (status === 'verified') {
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

  if (status === 'errored') {
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
            {retryVerb} to retry
          </Text>
        </YStack>
      </ItemContainer>
    );
  }

  if (status === 'invalid') {
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
      <LoadingSpinner color="$secondaryText" />
      <Text size="$label/l">Loading...</Text>
    </ItemContainer>
  );
}

function AttestationValueDisplay({
  attestation,
  currentUserId,
}: {
  attestation: db.Attestation;
  currentUserId: string;
}) {
  if (attestation.type === 'twitter') {
    return (
      <Text size="$title/l">
        {attestation.value
          ? domain.twitterHandleDisplay(attestation.value)
          : 'X Account'}
      </Text>
    );
  }

  if (attestation.type === 'phone') {
    if (attestation.contactId === currentUserId && attestation.value) {
      return (
        <Text size="$title/l">
          {domain.displayablePhoneNumber(attestation.value)}
        </Text>
      );
    } else {
      return <HiddenPhoneDisplay />;
    }
  }

  return null;
}
