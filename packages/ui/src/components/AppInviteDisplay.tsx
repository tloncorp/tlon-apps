import { DeepLinkMetadata } from '@tloncorp/shared/dist';
import React, { ComponentProps } from 'react';

import { ListItem } from './ListItem';

function AppInviteDisplayRaw({
  metadata,
  ...rest
}: { metadata: DeepLinkMetadata } & ComponentProps<typeof ListItem>) {
  const {
    inviterUserId,
    invitedGroupId,
    inviterNickname,
    invitedGroupTitle,
    invitedGroupIconImageUrl,
    invitedGroupiconImageColor,
  } = metadata;

  if (!inviterUserId || !invitedGroupId) {
    return null;
  }

  const groupShim = {
    id: invitedGroupId,
    title: invitedGroupTitle,
    iconImage: invitedGroupIconImageUrl,
    iconImageColor: invitedGroupiconImageColor,
  };

  return (
    <ListItem backgroundColor="$secondaryBackground" {...rest}>
      {invitedGroupIconImageUrl ? (
        <ListItem.GroupIcon
          model={groupShim}
          backgroundColor={groupShim.iconImageColor ?? '$secondaryBorder'}
        />
      ) : null}
      <ListItem.MainContent>
        <ListItem.Title>
          Join {invitedGroupTitle ?? invitedGroupId}
        </ListItem.Title>
        <ListItem.Subtitle>
          Invited by {inviterNickname ?? inviterUserId}
        </ListItem.Subtitle>
      </ListItem.MainContent>
    </ListItem>
  );
}

export const AppInviteDisplay = React.memo(AppInviteDisplayRaw);
