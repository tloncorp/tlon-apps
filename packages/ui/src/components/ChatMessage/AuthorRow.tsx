import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';

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

export default function AuthorRow({
  author,
  authorId,
  sent,
  roles,
  deliveryStatus,
}: {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
}) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);
  const firstRole = roles?.[0];

  return (
    <XStack gap="$l" alignItems="center">
      <Avatar size="$2xl" contact={author} contactId={authorId} />
      <ContactName showAlias name={authorId} />
      <SizableText color="$secondaryText" size="$s" position="relative" top={1}>
        {timeDisplay}
      </SizableText>
      {firstRole && <RoleBadge role={firstRole} />}
      {deliveryStatus && <ChatMessageDeliveryStatus status={deliveryStatus} />}
    </XStack>
  );
}
