import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import QRCode from 'react-qr-code';
import { View, useTheme } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { PersonalInviteButton } from './PersonalInviteButton';

export function PersonalInviteSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inviteLink = db.personalInviteLink.useValue();
  const theme = useTheme();

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} snapPointsMode="fit">
      <ActionSheet.SimpleHeader title="Invite Friends to TM" />
      <ActionSheet.Content paddingHorizontal={40}>
        <Text size="$label/m" color="$secondaryText" marginBottom="$2xl">
          Anyone you invite will skip the waitlist and be added to your
          contacts. You&apos;ll receive a DM when they join.
        </Text>
        <View
          width="100%"
          display="flex"
          alignItems="center"
          marginBottom="$3xl"
        >
          {inviteLink && (
            <QRCode
              value={inviteLink}
              size={200}
              fgColor={theme.primaryText.val}
              bgColor="transparent"
            />
          )}
        </View>
        <PersonalInviteButton />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
