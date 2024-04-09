import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';

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
  sent,
  roles,
}: {
  author: db.Contact;
  sent: number;
  roles?: string[];
}) {
  const date = new Date(sent);
  const timeDisplay = useMemo(
    () => utils.makePrettyDayAndDateAndTime(date),
    [date]
  );
  const firstRole = roles?.[0];

  return (
    <XStack gap="$l" alignItems="center">
      <Avatar height="$2xl" width="$2xl" contact={author} />
      <ContactName showAlias name={author.id} />
      <SizableText color="$secondaryText" size="$s">
        {timeDisplay.time}
      </SizableText>
      {firstRole && <RoleBadge role={firstRole} />}
    </XStack>
  );
}
