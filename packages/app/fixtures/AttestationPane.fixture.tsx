import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useSelect } from 'react-cosmos/client';
import { YStack } from 'tamagui';

import { AttestationPane } from '../ui/components/AttestationPane';
import { FixtureWrapper } from './FixtureWrapper';

const mockTwitterAttestation: db.Attestation = {
  id: '1',
  contactId: '~zod',
  provider: 'tlon',
  type: 'twitter',
  value: '@tlonmessenger',
  status: 'verified',
  statusMessage: null,
  signature: 'mock-signature-123',
  providerUrl: null,
  provingTweetId: '1234567890',
  initiatedAt: Date.now(),
  discoverability: 'public',
};

const mockPhoneAttestation: db.Attestation = {
  id: '2',
  contactId: '~zod',
  provider: 'tlon',
  type: 'phone',
  value: '+1234567890',
  status: 'verified',
  statusMessage: null,
  signature: 'mock-signature-456',
  providerUrl: null,
  provingTweetId: null,
  initiatedAt: Date.now(),
  discoverability: 'hidden',
};

const mockOtherUserTwitterAttestation: db.Attestation = {
  ...mockTwitterAttestation,
  id: '3',
  contactId: '~sampel-palnet',
};

const mockOtherUserPhoneAttestation: db.Attestation = {
  ...mockPhoneAttestation,
  id: '4',
  contactId: '~sampel-palnet',
};

function AttestationPaneFixture() {
  const [attestationType] = useSelect<'twitter' | 'phone'>('Type', {
    defaultValue: 'twitter',
    options: ['twitter', 'phone'],
  });

  const [isOwnAttestation] = useSelect<'own' | 'other'>('Owner', {
    defaultValue: 'own',
    options: ['own', 'other'],
  });

  const attestation =
    attestationType === 'twitter'
      ? isOwnAttestation === 'own'
        ? mockTwitterAttestation
        : mockOtherUserTwitterAttestation
      : isOwnAttestation === 'own'
        ? mockPhoneAttestation
        : mockOtherUserPhoneAttestation;

  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$2xl">
        <Text size="$title/l">
          {attestationType === 'twitter' ? '𝕏 Verification' : 'Phone Verification'}
        </Text>
        <Text size="$label/m" color="$secondaryText">
          {isOwnAttestation === 'own'
            ? 'Viewing your own attestation (can revoke)'
            : "Viewing someone else's attestation"}
        </Text>
        <AttestationPane attestation={attestation} currentUserId="~zod" />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Attestation Pane': <AttestationPaneFixture />,
};
