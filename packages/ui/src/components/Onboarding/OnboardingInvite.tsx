import { DeepLinkMetadata } from '@tloncorp/shared';
import React, { ComponentProps } from 'react';

import { AppDataContextProvider } from '../../contexts';
import { getDisplayName } from '../../utils';
import { ListItem } from '../ListItem';

interface GroupShim {
  id: string;
  title: string | undefined;
  iconImage: string | undefined;
  iconImageColor: string | undefined;
}

interface Inviter {
  id: string;
  nickname: string | undefined;
  avatarImage: string | undefined;
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
    id: inviterUserId!,
    nickname: inviterNickname,
    avatarImage: inviterAvatarImage,
  } as Inviter;

  const groupShim = {
    id: invitedGroupId,
    title: invitedGroupTitle,
    iconImage: invitedGroupIconImageUrl,
    iconImageColor: invitedGroupiconImageColor,
  } as GroupShim;

  if (inviteType === 'user') {
    return <UserInvite inviter={inviter} {...rest} />;
  }

  return <GroupInvite groupShim={groupShim} inviter={inviter} {...rest} />;
});

function UserInvite({
  inviter,
  ...rest
}: { inviter: Inviter } & ComponentProps<typeof ListItem>) {
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
          width={100}
          height={100}
          contactId={inviter.id}
          overrideUrl={inviter.avatarImage}
        />
        <ListItem.MainContent>
          <ListItem.Title>{getDisplayName(inviter)}</ListItem.Title>
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
}: { groupShim: GroupShim; inviter: Inviter } & ComponentProps<
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
          width={100}
          height={100}
          model={groupShim}
          backgroundColor={groupShim.iconImageColor ?? '$secondaryBorder'}
        />
        <ListItem.MainContent>
          <ListItem.Title>
            Join {groupShim.title ?? groupShim.id}
          </ListItem.Title>
          <ListItem.Subtitle>
            Invited by {inviter.nickname ?? inviter.id}
          </ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>
    </AppDataContextProvider>
  );
}
