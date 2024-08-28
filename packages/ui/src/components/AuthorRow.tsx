import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import { View, XStack } from 'tamagui';

import { useNavigation } from '../contexts';
import { ContactAvatar } from './Avatar';
import { ChatMessageDeliveryStatus } from './ChatMessage/ChatMessageDeliveryStatus';
import { ContactName } from './ContactNameV2';
import { ProfileSheet } from './ProfileSheet';
import { Text } from './TextV2';

const RoleBadge = View.styleable<{ role: string }>(
  ({ role, ...props }, ref) => {
    return (
      <View
        marginVertical={'$-xs'}
        borderRadius="$l"
        backgroundColor="$shadow"
        paddingHorizontal="$m"
        paddingVertical="$xs"
        {...props}
        ref={ref}
      >
        <Text color="$secondaryText" size="$label/m">
          {role}
        </Text>
      </View>
    );
  }
);

export const AUTHOR_ROW_HEIGHT_DETAIL_VIEW = '$4xl';

type AuthorRowProps = ComponentProps<typeof XStack> & {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  detailView?: boolean;
  showEditedIndicator?: boolean;
};

export default function AuthorRow({ onPress, ...props }: AuthorRowProps) {
  const [showProfile, setShowProfile] = useState(false);
  const navContext = useNavigation();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (props.type !== 'block') {
        navContext.onGoToUserProfile?.(props.authorId);
        onPress?.(e);
      }
    },
    [props.type, props.authorId, navContext, onPress]
  );

  return (
    <>
      {props.detailView ? (
        <DetailViewAuthorRow {...props} onPress={handlePress} />
      ) : props.type === 'block' ? (
        <BlockAuthorRow {...props} onPress={handlePress} />
      ) : props.type === 'note' ? (
        <NotebookAuthorRow {...props} onPress={handlePress} />
      ) : (
        <ChatAuthorRow {...props} onPress={handlePress} />
      )}
      {showProfile && props.author && (
        <ProfileSheet
          open={showProfile}
          contact={props.author}
          contactId={props.authorId}
          onOpenChange={setShowProfile}
        />
      )}
    </>
  );
}

function DetailViewAuthorRow({ authorId, ...props }: AuthorRowProps) {
  return (
    <XStack gap="$s" alignItems="center" {...props}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <ContactName width="100%" contactId={authorId} />
    </XStack>
  );
}

function ChatAuthorRow({
  authorId,
  showEditedIndicator,
  sent,
  roles,
  deliveryStatus,
  ...props
}: AuthorRowProps) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);

  const firstRole = roles?.[0];

  return (
    <XStack gap="$l" alignItems="center" {...props}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <XStack gap="$l" alignItems="flex-end">
        <ContactName size="$label/2xl" contactId={authorId} />
        <Text color="$secondaryText" size="$label/m">
          {timeDisplay}
        </Text>
        {showEditedIndicator && (
          <Text size="$label/m" color="$secondaryText">
            Edited
          </Text>
        )}
        {firstRole && <RoleBadge role={firstRole} />}
      </XStack>
      {deliveryStatus && <ChatMessageDeliveryStatus status={'pending'} />}
    </XStack>
  );
}

function NotebookAuthorRow({ authorId, ...props }: AuthorRowProps) {
  return (
    <XStack gap="$m" alignItems="center" {...props}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <ContactName size="$body" color="$secondaryText" contactId={authorId} />
    </XStack>
  );
}

function BlockAuthorRow({ authorId, ...props }: AuthorRowProps) {
  return (
    <XStack
      padding="$m"
      overflow="hidden"
      gap="$s"
      alignItems="center"
      justifyContent="space-between"
      {...props}
    >
      <ContactAvatar size="$2xl" contactId={authorId} />
    </XStack>
  );
}
