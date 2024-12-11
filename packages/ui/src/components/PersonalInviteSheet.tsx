import { ListItem, TlonText } from '..';
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
    <ActionSheet open={open} onOpenChange={onOpenChange} snapPointsMode="fit">
      <ActionSheet.Header>
        <ListItem.Title>Invite Friends to TM</ListItem.Title>
      </ActionSheet.Header>
      <ActionSheet.ContentBlock paddingTop="$m" paddingBottom="$9xl">
        <ActionSheet.ContentBlock>
          <TlonText.Text size="$label/m" color="$secondaryText">
            Anyone you invite will skip the waitlist and be added to your
            contacts. You&apos;ll receive a DM when they join.
          </TlonText.Text>
        </ActionSheet.ContentBlock>
        <ActionSheet.ContentBlock>
          <PersonalInviteButton />
        </ActionSheet.ContentBlock>
      </ActionSheet.ContentBlock>
    </ActionSheet>
  );
}
