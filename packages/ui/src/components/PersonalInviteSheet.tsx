import * as db from '@tloncorp/shared/db';
import QRCode from 'react-qr-code';

import { ListItem, TlonText, View } from '..';
import { useTheme } from '../';
import { ActionSheet } from './ActionSheet';
import { PersonalInviteButton } from './PersonalInviteButton';

export function PersonalInviteSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inviteLink = db.personalInviteLink.useValue() as string;
  const theme = useTheme();

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} snapPointsMode="fit">
      <ActionSheet.Header>
        <ListItem.Title>Invite Friends to TM</ListItem.Title>
      </ActionSheet.Header>
      <ActionSheet.Content>
        <ActionSheet.ContentBlock>
          <TlonText.Text size="$label/m" color="$secondaryText">
            Anyone you invite will skip the waitlist and be added to your
            contacts. You&apos;ll receive a DM when they join.
          </TlonText.Text>
        </ActionSheet.ContentBlock>
        <ActionSheet.ContentBlock>
          <View padding="$l" width="100%" display="flex" alignItems="center">
            <QRCode
              value={inviteLink}
              size={200}
              fgColor={theme.primaryText.val}
              bgColor="transparent"
            />
          </View>
        </ActionSheet.ContentBlock>
        <ActionSheet.ContentBlock>
          <PersonalInviteButton />
        </ActionSheet.ContentBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
