import { TlonText } from '..';
import { ActionSheet } from './ActionSheet';
import { PersonalInviteButton } from './PersonalInviteButton';

export function PersonalInviteSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[60]}
    >
      <ActionSheet.Content>
        <ActionSheet.ContentBlock gap="$2xl">
          <ActionSheet.ActionTitle>
            Invite friends to TM
          </ActionSheet.ActionTitle>
          <TlonText.Text size="$label/m">
            You can invite friends to join Tlon and skip the waitlist. When they
            signup, you'll get a DM and they'll be added to your contacts.
          </TlonText.Text>
        </ActionSheet.ContentBlock>
        <ActionSheet.ContentBlock>
          <PersonalInviteButton />
        </ActionSheet.ContentBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
