import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, XStack } from '../../core';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';

export default function GalleryAuthorRow({
  author,
  authorId,
  sent,
  width,
}: {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  width: number;
  deliveryStatus?: db.PostDeliveryStatus | null;
}) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);

  return (
    <XStack
      paddingHorizontal="$l"
      width={width}
      overflow="hidden"
      gap="$s"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack gap="$s" alignItems="center">
        <Avatar size="$2xl" contact={author} contactId={authorId} />
        <ContactName
          maxWidth="65%"
          showNickname
          userId={authorId}
          fontWeight="500"
          // Shadow added so that we can see the author even if the image
          // is dark
          textShadowColor="$background"
          textShadowOffset={{ width: 0, height: 1 }}
          textShadowRadius={8}
          size="$s"
        />
      </XStack>
      <SizableText color="$primaryText" size="$xs" position="relative" top={1}>
        {timeDisplay}
      </SizableText>
    </XStack>
  );
}
