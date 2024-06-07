import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, XStack } from '../../core';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import ContactName from '../ContactName';

export default function AuthorRow({
  author,
  authorId,
  sent,
  roles,
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
      <ContactName showNickname userId={authorId} fontWeight="500" />
      <SizableText color="$secondaryText" size="$s" position="relative" top={1}>
        {timeDisplay}
      </SizableText>
      {firstRole && <Badge text={firstRole} type="neutral" />}
    </XStack>
  );
}
