import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import { ComponentProps, useMemo } from 'react';
import { isWeb } from 'tamagui';

import { AvatarProps } from '../Avatar';
import { Badge } from '../Badge';
import { ListItem } from './ListItem';
import { useBoundHandler } from './listItemUtils';

export const SystemContactListItem = ({
  systemContact,
  invitedToContext,
  showInvitedStatus = false,
  iconProps,
  onPress,
  onLongPress,
  showEndContent = false,
  endContent,
  ...props
}: {
  systemContact: db.SystemContact;
  iconProps?: Partial<ComponentProps<typeof ListItem.SystemIcon>>;
  invitedToContext?: string;
  showInvitedStatus?: boolean;
  onPress?: (systemContact: db.SystemContact) => void;
  onLongPress?: (systemContact: db.SystemContact) => void;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
  subtitle?: string;
} & Omit<ComponentProps<typeof ListItem>, 'onPress' | 'onLongPress'> &
  Pick<AvatarProps, 'size'>) => {
  const handlePress = useBoundHandler(systemContact, onPress);
  const handleLongPress = useBoundHandler(systemContact, onLongPress);

  const phoneNumberDisplay = useMemo(
    () =>
      systemContact.phoneNumber
        ? domain.displayablePhoneNumber(systemContact.phoneNumber)
        : null,
    [systemContact.phoneNumber]
  );

  const invitedToKey = useMemo(
    () => invitedToContext ?? domain.InvitedToPersonalKey,
    [invitedToContext]
  );

  const wasInvited = useMemo(() => {
    const matchingInvite = systemContact.sentInvites?.find(
      (invite) => invite.invitedTo === invitedToKey
    );
    return Boolean(matchingInvite);
  }, [invitedToKey, systemContact.sentInvites]);

  return (
    <Pressable
      borderRadius="$xl"
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <ListItem alignItems="center" justifyContent="flex-start" {...props}>
        <ListItem.SystemIcon icon="SmushStar" {...iconProps} />
        <ListItem.MainContent>
          <ListItem.Title>
            {systemContact.firstName} {systemContact.lastName}
          </ListItem.Title>
          <ListItem.Subtitle>
            {phoneNumberDisplay ?? systemContact.email}
          </ListItem.Subtitle>
        </ListItem.MainContent>
        {showInvitedStatus && (
          <ListItem.EndContent>
            <Badge
              type={wasInvited ? 'neutral' : 'positive'}
              text={wasInvited ? 'Invited' : 'Invite'}
            />
          </ListItem.EndContent>
        )}
        {showEndContent && (
          <ListItem.EndContent
            flexGrow={isWeb ? 1 : 'unset'}
            justifyContent="flex-end"
          >
            {endContent}
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
};
