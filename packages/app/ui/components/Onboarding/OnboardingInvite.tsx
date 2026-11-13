import { DeepLinkMetadata } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import React, { ComponentProps } from 'react';

import { AppDataContextProvider } from '../../contexts/appDataContext';
import { resolveContactNameProps } from '../ContactNameV2';
import { ListItem } from '../ListItem';

interface GroupShim {
  id: string;
  title: string | undefined;
  iconImage: string | undefined;
  iconImageColor: string | undefined;
}

export const OnboardingInviteBlock = React.memo(function OnboardingInviteBlock({
  metadata,
  ...rest
}: { metadata: DeepLinkMetadata } & ComponentProps<typeof ListItem>) {
  const {
    inviterUserId,
    invitedGroupId,
    inviterNickname,
    inviterAvatarImage,
    inviterColor,
    invitedGroupTitle,
    invitedGroupIconImageUrl,
    invitedGroupiconImageColor,
    inviteType,
  } = metadata;

  const isValidUserInvite = inviterUserId && inviteType === 'user';
  const isValidGroupInvite = inviterUserId && invitedGroupId;

  if (!isValidUserInvite && !isValidGroupInvite) {
    return null;
  }

  const inviter = {
    id: inviterUserId,
    nickname: inviterNickname,
    avatarImage: inviterAvatarImage,
    color: inviterColor || undefined,
  } as db.Contact;

  const groupShim = {
    id: invitedGroupId,
    title: invitedGroupTitle,
    iconImage: invitedGroupIconImageUrl,
    iconImageColor: invitedGroupiconImageColor,
  } as GroupShim;

  // workaround for our generic invites that boot you into empty state. Should be
  // removed once a better backend solution is in place
  const isWorkaroundInvite = inviteType === 'user' && groupShim.title;

  if (inviteType === 'user' && !isWorkaroundInvite) {
    return <UserInvite inviter={inviter} {...rest} />;
  }

  return <GroupInvite groupShim={groupShim} inviter={inviter} {...rest} />;
});

// The inviter comes from invite metadata and the user has no Calm settings
// yet, so this resolves the name directly instead of through the db.
function inviterName(inviter: db.Contact) {
  return resolveContactNameProps({
    contact: inviter,
    contactId: inviter.id,
    calmDisableNicknames: false,
  }).children;
}

function UserInvite({
  inviter,
  ...rest
}: { inviter: db.Contact } & ComponentProps<typeof ListItem>) {
  return (
    // provider needed to support calm settings usage down the tree
    <AppDataContextProvider>
      <ListItem
        backgroundColor="$background"
        borderColor="$border"
        borderWidth={1}
        alignItems="center"
        {...rest}
      >
        <ListItem.ContactIcon
          contactId={inviter.id}
          contactOverride={inviter}
        />
        <ListItem.MainContent>
          <ListItem.Title>{inviterName(inviter)}</ListItem.Title>
          <ListItem.Subtitle>Sent you a personal invite</ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>
    </AppDataContextProvider>
  );
}

function GroupInvite({
  groupShim,
  inviter,
  ...rest
}: { groupShim: GroupShim; inviter: db.Contact } & ComponentProps<
  typeof ListItem
>) {
  return (
    // provider needed to support calm settings usage down the tree
    <AppDataContextProvider>
      <ListItem
        backgroundColor="$background"
        borderColor="$border"
        borderWidth={1}
        alignItems="center"
        {...rest}
      >
        <ListItem.GroupIcon
          model={groupShim}
          backgroundColor={groupShim.iconImageColor ?? '$secondaryBorder'}
        />
        <ListItem.MainContent>
          <ListItem.Title>
            {groupShim.title ? `Join ${groupShim.title}` : `Join a workspace`}
          </ListItem.Title>
          <ListItem.Subtitle>
            Invited by {inviterName(inviter)}
          </ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>
    </AppDataContextProvider>
  );
}
