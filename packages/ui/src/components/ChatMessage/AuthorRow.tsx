import { ClientTypes, utils } from '@tloncorp/shared';
import { SizableText, View, XStack } from 'tamagui';

import { Avatar } from '../Avatar';
import ShipName from '../ShipName';

const RoleBadge = ({ role }: { role: string }) => {
  return (
    <View
      borderRadius="$l"
      backgroundColor="$secondaryBackground"
      paddingHorizontal="$s"
    >
      <SizableText fontWeight="$s" color="$secondaryText" size="$s">
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
  author: ClientTypes.Contact;
  sent: string;
  roles?: string[];
}) {
  const date = new Date(sent);
  const timeDisplay = utils.makePrettyDayAndDateAndTime(date);
  const firstRole = roles?.[0];

  return (
    <XStack gap="$space.l">
      <Avatar height="$2xl" width="$2xl" contact={author} />
      <ShipName showAlias name={author.id} fontWeight="$l" />
      <SizableText fontWeight="$s" color="$secondaryText" size="$s">
        {timeDisplay.time}
      </SizableText>
      {firstRole && <RoleBadge role={firstRole} />}
    </XStack>
  );
}
