import { DeepLinkMetadata } from '@tloncorp/shared/dist';
import React from 'react';

import { ListItem } from './ListItem';

function AppInviteDisplayRaw({ metadata }: { metadata: DeepLinkMetadata }) {
  const {
    inviterUserId,
    invitedGroupId,
    inviterNickname,
    invitedGroupTitle,
    invitedGroupIconImageUrl,
  } = metadata;

  if (!inviterUserId || !invitedGroupId) {
    return null;
  }

  return (
    <ListItem
      marginHorizontal="$3xl"
      backgroundColor="$secondaryBackground"
      marginBottom="$4xl"
    >
      {invitedGroupIconImageUrl ? (
        <ListItem.ImageIcon imageUrl={invitedGroupIconImageUrl} />
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
