import { DeepLinkMetadata } from '@tloncorp/shared/dist';
import React, { ComponentProps } from 'react';

import { AppDataContextProvider } from '../contexts';
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
    // provider needed to support calm settings usage down the tree
    <AppDataContextProvider>
      <ListItem backgroundColor="$secondaryBackground" {...rest}>
        <ListItem.GroupIcon
          model={groupShim}
          backgroundColor={groupShim.iconImageColor ?? '$secondaryBorder'}
        />
        <ListItem.MainContent>
          <ListItem.Title>
            Join {invitedGroupTitle ?? invitedGroupId}
          </ListItem.Title>
          <ListItem.Subtitle>
            Invited by {inviterNickname ?? inviterUserId}
          </ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>
    </AppDataContextProvider>
  );
}

export const AppInviteDisplay = React.memo(AppInviteDisplayRaw);
