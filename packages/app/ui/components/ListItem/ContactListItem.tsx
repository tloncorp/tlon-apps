import { ComponentProps } from 'react';
import { isWeb } from 'tamagui';

import { AvatarProps } from '../Avatar';
import ContactName from '../ContactName';
import { Pressable } from '@tloncorp/ui';
import { ListItem } from './ListItem';
import { useBoundHandler } from './listItemUtils';

export const ContactListItem = ({
  contactId,
  onPress,
  onLongPress,
  showNickname = false,
  showUserId = false,
  full = false,
  showIcon = true,
  showEndContent = false,
  endContent,
  matchText,
  subtitle,
  size = '$2xl',
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
  const handlePress = useBoundHandler(contactId, onPress);
  const handleLongPress = useBoundHandler(contactId, onLongPress);

  return (
    <Pressable
      borderRadius="$xl"
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <ListItem alignItems="center" justifyContent="flex-start" {...props}>
        {showIcon && <ListItem.ContactIcon size={size} contactId={contactId} />}
        <ListItem.MainContent>
          <ListItem.Title>
            <ContactName
              matchText={matchText}
              showNickname={showNickname}
              showUserId={!showNickname && showUserId}
              full={full}
              userId={contactId}
            />
          </ListItem.Title>
          {showUserId && showNickname ? (
            <ListItem.Subtitle>{contactId}</ListItem.Subtitle>
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
