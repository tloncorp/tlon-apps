import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useMemo } from 'react';
import { ColorTokens, View, XStack } from 'tamagui';

import { useNavigation } from '../contexts';
import { ContactAvatar } from './Avatar';
import { ChatMessageDeliveryStatus } from './ChatMessage/ChatMessageDeliveryStatus';
import { ContactName } from './ContactNameV2';
import { useBoundHandler } from './ListItem/listItemUtils';
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
  sent?: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  detailView?: boolean;
  showEditedIndicator?: boolean;
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
  ...props
}: AuthorRowProps & { color?: ColorTokens }) {
  const openProfile = useNavigateToProfile(authorId);
  return (
    <XStack gap="$l" alignItems="center" {...props} onPress={openProfile}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <ContactName
        contactId={authorId}
        size="$label/l"
        color={color ?? '$secondaryText'}
      />
    </XStack>
  );
}

export function ChatAuthorRow({
  authorId,
  showEditedIndicator,
  sent,
  roles,
  deliveryStatus,
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

  return (
    <XStack gap="$l" alignItems="center" {...props} onPress={openProfile}>
      <ContactAvatar size="$2xl" contactId={authorId} />
      <XStack gap="$l" alignItems="flex-end">
        <ContactName size="$label/2xl" contactId={authorId} />
        {timeDisplay && (
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
        {deliveryStatus === 'failed' ? (
          <Text size="$label/m" color="$negativeActionText">
            Failed to send
          </Text>
        ) : null}
      </XStack>
      {deliveryStatus && deliveryStatus !== 'failed' ? (
        <ChatMessageDeliveryStatus status={deliveryStatus} />
      ) : null}
    </XStack>
  );
}
