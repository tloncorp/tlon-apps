import * as utils from '@tloncorp/api/lib/utils';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { ColorTokens, View, XStack } from 'tamagui';

import { useNavigation } from '../contexts/navigation';
import { ContactAvatar } from './Avatar';
import { Badge } from './Badge';
import { ChatMessageDeliveryStatus } from './ChatMessage/ChatMessageDeliveryStatus';
import { ContactName } from './ContactNameV2';
import { SentTimeText } from './SentTimeText';
import { useBoundHandler } from './listItems/listItemUtils';

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
  sent?: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  deleteStatus?: db.PostDeliveryStatus | null;
  editStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  isBot?: boolean;
  detailView?: boolean;
  showEditedIndicator?: boolean;
  showSentAt?: boolean;
};

export function useNavigateToProfile(userId: string) {
  const { onGoToUserProfile } = useNavigation();
  return useBoundHandler(userId, onGoToUserProfile);
}

export default function AuthorRow({ ...props }: AuthorRowProps) {
  return props.detailView || props.type === 'note' ? (
    <DetailViewAuthorRow {...props} />
  ) : (
    <ChatAuthorRow {...props} />
  );
}

export function DetailViewAuthorRow({
  authorId,
  color,
  showEditedIndicator,
  deliveryStatus,
  deleteStatus,
  editStatus,
  showSentAt,
  sent,
  isBot,
  ...props
}: {
  authorId: string;
  showEditedIndicator?: boolean;
  deliveryStatus?: db.PostDeliveryStatus | null;
  editStatus?: db.PostDeliveryStatus | null;
  deleteStatus?: db.PostDeliveryStatus | null;
  color?: ColorTokens;
  showSentAt?: boolean;
  sent?: number;
  type?: db.PostType;
  isBot?: boolean;
} & ComponentProps<typeof XStack>) {
  const openProfile = useNavigateToProfile(authorId);
  const deliveryFailed =
    deliveryStatus === 'failed' ||
    editStatus === 'failed' ||
    deleteStatus === 'failed';
  const shouldTruncate = showEditedIndicator || deliveryFailed;

  return (
    <XStack
      cursor="default"
      gap="$l"
      alignItems="center"
      userSelect="none"
      {...props}
    >
      <ContactAvatar
        cursor="pointer"
        size="$2xl"
        contactId={authorId}
        onPress={openProfile}
      />
      <Text
        size="$label/l"
        numberOfLines={1}
        maxWidth={shouldTruncate ? '55%' : '100%'}
        color={color ?? '$secondaryText'}
        cursor="pointer"
        onPress={deliveryFailed ? undefined : openProfile}
      >
        <ContactName contactId={authorId} />
      </Text>
      {showSentAt && <SentTimeText sentAt={sent} showFullDate />}
      {isBot && <Badge type="neutral" size="micro" text="Bot" />}
    </XStack>
  );
}

export function ChatAuthorRow({
  authorId,
  showEditedIndicator,
  sent,
  roles,
  deliveryStatus,
  editStatus,
  deleteStatus,
  showSentAt = true,
  isBot,
  ...props
}: AuthorRowProps) {
  const openProfile = useNavigateToProfile(authorId);
  const firstRole = roles?.[0];

  const deliveryFailed =
    deliveryStatus === 'failed' ||
    editStatus === 'failed' ||
    deleteStatus === 'failed';

  const shouldTruncate = showEditedIndicator || firstRole || deliveryFailed;

  return (
    <XStack
      cursor="default"
      gap="$l"
      alignItems="center"
      userSelect="none"
      {...props}
    >
      <ContactAvatar
        cursor="pointer"
        onPress={openProfile}
        size="$2xl"
        contactId={authorId}
      />
      <XStack gap="$l" alignItems="center" flex={1}>
        <Text
          size="$label/2xl"
          numberOfLines={1}
          maxWidth={shouldTruncate ? '55%' : '100%'}
          onPress={deliveryFailed ? undefined : openProfile}
          cursor="pointer"
        >
          <ContactName contactId={authorId} />
        </Text>
        {showSentAt && <SentTimeText sentAt={sent} paddingTop="$xs" />}
        {isBot && <Badge type="neutral" size="micro" text="Bot" />}
        {showEditedIndicator && (
          <Text size="$label/m" color="$secondaryText" paddingTop="$xs">
            Edited
          </Text>
        )}
        {firstRole && <RoleBadge role={firstRole} />}
      </XStack>
      {!!deliveryStatus && deliveryStatus !== 'failed' ? (
        <ChatMessageDeliveryStatus status={deliveryStatus} />
      ) : null}
    </XStack>
  );
}
