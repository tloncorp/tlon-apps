import { DeepLinkMetadata } from '@tloncorp/shared';
import { Text } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import {
  OnboardingBenefitsSheet,
  OnboardingButton,
  OnboardingButtonWrapper,
  OnboardingInviteBlock,
  OnboardingTextBlock,
} from '../ui/components/Onboarding';
import { FixtureWrapper } from './FixtureWrapper';

function OnboardingButtonFixture() {
  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$2xl">
        <Text size="$label/l" color="$secondaryText">
          Primary Button
        </Text>
        <OnboardingButton label="Get Started" onPress={() => {}} />

        <Text size="$label/l" color="$secondaryText">
          Secondary Button
        </Text>
        <OnboardingButton
          label="I have an account"
          secondary
          onPress={() => {}}
        />

        <Text size="$label/l" color="$secondaryText">
          Loading State
        </Text>
        <OnboardingButton label="Loading..." loading onPress={() => {}} />

        <Text size="$label/l" color="$secondaryText">
          Disabled State
        </Text>
        <OnboardingButton label="Disabled" disabled onPress={() => {}} />

        <Text size="$label/l" color="$secondaryText">
          Button Wrapper
        </Text>
        <OnboardingButtonWrapper>
          <OnboardingButton label="Primary Action" onPress={() => {}} />
          <OnboardingButton
            label="Secondary Action"
            secondary
            onPress={() => {}}
          />
        </OnboardingButtonWrapper>
      </YStack>
    </FixtureWrapper>
  );
}

function OnboardingTextBlockFixture() {
  return (
    <FixtureWrapper fillWidth safeArea>
      <OnboardingTextBlock>
        <Text size="$title/l">Welcome to Tlon</Text>
        <Text size="$body" color="$secondaryText">
          This is a text block used in onboarding screens to display
          informational content with consistent spacing.
        </Text>
        <Text size="$label/m" color="$tertiaryText">
          Additional helper text can go here.
        </Text>
      </OnboardingTextBlock>
    </FixtureWrapper>
  );
}

const mockUserInviteMetadata: DeepLinkMetadata = {
  inviterUserId: '~sampel-palnet',
  inviterNickname: 'Sample User',
  inviterAvatarImage: undefined,
  inviterColor: '#4E9A06',
  inviteType: 'user',
};

const mockGroupInviteMetadata: DeepLinkMetadata = {
  inviterUserId: '~sampel-palnet',
  inviterNickname: 'Sample User',
  inviterAvatarImage: undefined,
  inviterColor: '#4E9A06',
  invitedGroupId: '~sampel-palnet/test-group',
  invitedGroupTitle: 'Test Group',
  invitedGroupIconImageUrl: undefined,
  invitedGroupiconImageColor: '#729FCF',
  inviteType: 'group',
};

function OnboardingInviteBlockFixture() {
  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$2xl">
        <Text size="$label/l" color="$secondaryText">
          User Invite
        </Text>
        <OnboardingInviteBlock metadata={mockUserInviteMetadata} />

        <Text size="$label/l" color="$secondaryText">
          Group Invite
        </Text>
        <OnboardingInviteBlock metadata={mockGroupInviteMetadata} />
      </YStack>
    </FixtureWrapper>
  );
}

function OnboardingBenefitsSheetFixture() {
  const [open, setOpen] = useState(true);

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="center" alignItems="center">
        <OnboardingButton label="Open Benefits Sheet" onPress={() => setOpen(true)} />
      </YStack>
      <OnboardingBenefitsSheet open={open} onOpenChange={setOpen} />
    </FixtureWrapper>
  );
}

export default {
  'Onboarding Button': <OnboardingButtonFixture />,
  'Onboarding Text Block': <OnboardingTextBlockFixture />,
  'Onboarding Invite Block': <OnboardingInviteBlockFixture />,
  'Onboarding Benefits Sheet': <OnboardingBenefitsSheetFixture />,
};
