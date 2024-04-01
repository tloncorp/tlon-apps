import { ClientTypes, utils } from '@tloncorp/shared';
import { SizableText, XStack } from 'tamagui';

import { Avatar } from '../Avatar';
import ShipName from '../ShipName';

export default function AuthorRow({
  author,
  sent,
}: {
  author: ClientTypes.Contact;
  sent: string;
}) {
  const date = new Date(sent);
  const timeDisplay = utils.makePrettyDayAndDateAndTime(date);

  return (
    <XStack gap="$space.l">
      <Avatar contact={author} />
      <ShipName showAlias name={author.id} />
      <SizableText color="$secondaryText" size="$s">
        {timeDisplay.time}
      </SizableText>
    </XStack>
  );
}
