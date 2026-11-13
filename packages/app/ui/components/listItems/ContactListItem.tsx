import { Pressable } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { XStack, isWeb } from 'tamagui';

import { AvatarProps } from '../Avatar';
import { BotBadge } from '../BotBadge';
import { ContactName } from '../ContactNameV2';
import { ListItem } from '../ListItem';
import { useBoundHandler } from './listItemUtils';

export const ContactListItem = ({
  contactId,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
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
  showIcon?: boolean;
  showEndContent?: boolean;
  endContent?: React.ReactNode;
  matchText?: string;
  subtitle?: string;
} & Omit<ComponentProps<typeof ListItem>, 'onPress' | 'onLongPress'> &
  Pick<AvatarProps, 'size'>) => {
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
          <XStack alignItems="center" gap="$s">
            <ListItem.Title flex={1} minWidth={0}>
              <ContactName
                contactId={contactId}
                mode={showNickname ? 'auto' : 'contactId'}
                matchText={matchText}
              />
            </ListItem.Title>
            <BotBadge contactId={contactId} />
          </XStack>
          {showUserId && showNickname ? (
            <ListItem.Subtitle>
              <ContactName contactId={contactId} mode="contactId" />
            </ListItem.Subtitle>
          ) : null}
          {subtitle && <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>}
        </ListItem.MainContent>
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
