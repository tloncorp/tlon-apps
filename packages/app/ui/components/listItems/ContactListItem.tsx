import { Pressable } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { XStack, isWeb } from 'tamagui';

import { AvatarProps } from '../Avatar';
import { BotBadge, useIsBotContact } from '../BotBadge';
import ContactName from '../ContactName';
import { ContactName as ContactNameV2 } from '../ContactNameV2';
import { ListItem } from '../ListItem';
import { useBoundHandler } from './listItemUtils';

export const ContactListItem = ({
  contactId,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
  full = true,
  showIcon = true,
  showEndContent = false,
  endContent,
  matchText,
  subtitle,
  size = '$2xl',
  hoverStyle,
  ...props
}: {
  contactId: string;
  onPress?: (contactId: string) => void;
  onLongPress?: (contactId: string) => void;
  showNickname?: boolean;
  showUserId?: boolean;
  full?: boolean;
  showIcon?: boolean;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
  subtitle?: string;
} & Omit<ComponentProps<typeof ListItem>, 'onPress' | 'onLongPress'> &
  Pick<AvatarProps, 'size'>) => {
  const isBot = useIsBotContact(contactId);
  const handlePress = useBoundHandler(contactId, onPress);
  const handleLongPress = useBoundHandler(contactId, onLongPress);

  return (
    <Pressable
      borderRadius="$xl"
      onPress={handlePress}
      onLongPress={handleLongPress}
      hoverStyle={hoverStyle}
    >
      <ListItem alignItems="center" justifyContent="flex-start" {...props}>
        {showIcon && <ListItem.ContactIcon size={size} contactId={contactId} />}
        <ListItem.MainContent minWidth={0}>
          <ListItem.Title flex={1} minWidth={0}>
            {matchText ? (
              // Use old ContactName for search highlighting
              <ContactName
                matchText={matchText}
                showNickname={showNickname}
                showUserId={!showNickname && showUserId}
                full={full}
                userId={contactId}
              />
            ) : (
              // Use ContactNameV2 for monospace styling
              <ContactNameV2
                contactId={contactId}
                mode={showNickname ? 'auto' : 'contactId'}
                expandLongIds={full}
              />
            )}
          </ListItem.Title>
          {showUserId && showNickname ? (
            <ListItem.Subtitle>
              <ContactNameV2
                contactId={contactId}
                mode="contactId"
                expandLongIds
              />
            </ListItem.Subtitle>
          ) : null}
          {subtitle && <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>}
        </ListItem.MainContent>
        {(showEndContent || isBot) && (
          <ListItem.EndContent
            flexGrow={isWeb ? 1 : 'unset'}
            justifyContent="flex-end"
          >
            <XStack alignItems="center" gap="$s">
              <BotBadge contactId={contactId} />
              {showEndContent ? endContent : null}
            </XStack>
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
};
