import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import { SizableText, View, XStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import ContactName from './ContactName';
import { ProfileSheet } from './ProfileSheet';

const RoleBadge = ({ role }: { role: string }) => {
  return (
    <View
      borderRadius="$l"
      backgroundColor="$secondaryBackground"
      paddingHorizontal="$s"
    >
      <SizableText color="$secondaryText" size="$s">
        {role}
      </SizableText>
    </View>
  );
};

export const AUTHOR_ROW_HEIGHT_DETAIL_VIEW = '$4xl';

type AuthorRowProps = ComponentProps<typeof XStack> & {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  detailView?: boolean;
};

export default function AuthorRow({ onPress, ...props }: AuthorRowProps) {
  const [showProfile, setShowProfile] = useState(false);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (props.type !== 'block') {
        setShowProfile(true);
        onPress?.(e);
      }
    },
    [props.type, onPress]
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
      <ContactName width="100%" showNickname userId={authorId} />
    </XStack>
  );
}

function ChatAuthorRow({ authorId, sent, roles, ...props }: AuthorRowProps) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);
  const firstRole = roles?.[0];

  return (
    <XStack gap="$l" alignItems="center" {...props}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <ContactName showNickname userId={authorId} fontWeight="$xl" />
      <SizableText color="$secondaryText" size="$s" position="relative" top={1}>
        {timeDisplay}
      </SizableText>
      {firstRole && <RoleBadge role={firstRole} />}
    </XStack>
  );
}

function NotebookAuthorRow({ authorId, ...props }: AuthorRowProps) {
  return (
    <XStack gap="$l" alignItems="center" {...props}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <ContactName
        width="100%"
        showNickname
        fontWeight={'500'}
        userId={authorId}
      />
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
