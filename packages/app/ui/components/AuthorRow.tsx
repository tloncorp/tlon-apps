import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ComponentProps, useMemo } from 'react';
import { ColorTokens, View, XStack } from 'tamagui';

import { useNavigation } from '../contexts';
import { ContactAvatar } from './Avatar';
import { ChatMessageDeliveryStatus } from './ChatMessage/ChatMessageDeliveryStatus';
import { ContactName } from './ContactNameV2';
import { useBoundHandler } from './ListItem/listItemUtils';

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
} & ComponentProps<typeof XStack>) {
  const openProfile = useNavigateToProfile(authorId);
  const deliveryFailed =
    deliveryStatus === 'failed' ||
    editStatus === 'failed' ||
    deleteStatus === 'failed';
  const shouldTruncate = showEditedIndicator || deliveryFailed;

  const timeDisplay = useMemo(() => {
    if (!showSentAt || !sent) {
      return null;
    }
    const date = new Date(sent ?? 0);
    if (utils.isToday(date.getTime())) {
      return utils.makePrettyTime(date);
    }
    const { asString } = utils.makePrettyDayAndDateAndTime(date);
    return asString;
  }, [showSentAt, sent]);

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
      {showSentAt && (
        <Text color="$secondaryText" size="$label/m">
          {timeDisplay}
        </Text>
      )}
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
  ...props
}: AuthorRowProps) {
  const openProfile = useNavigateToProfile(authorId);

  const timeDisplay = useMemo(() => {
    if (!sent) {
      return null;
    }
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);

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
      <XStack gap="$l" alignItems="flex-end" flex={1}>
        <Text
          size="$label/2xl"
          numberOfLines={1}
          maxWidth={shouldTruncate ? '55%' : '100%'}
          onPress={deliveryFailed ? undefined : openProfile}
          cursor="pointer"
        >
          <ContactName contactId={authorId} />
        </Text>
        {showSentAt && timeDisplay && (
          <Text color="$secondaryText" size="$label/m">
            {timeDisplay}
          </Text>
        )}
        {showEditedIndicator && (
          <Text size="$label/m" color="$secondaryText">
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
