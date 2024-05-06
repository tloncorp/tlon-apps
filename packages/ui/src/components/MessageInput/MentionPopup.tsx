import * as db from '@tloncorp/shared/dist/db';
import { desig } from '@tloncorp/shared/dist/urbit';
import { Dimensions } from 'react-native';

import { ContactList } from '../ContactList';

export default function MentionPopup({
  groupMembers,
  onPress,
  matchText,
}: {
  groupMembers: db.ChatMember[];
  onPress: (contact: db.Contact) => void;
  matchText?: string;
}) {
  const subSet = groupMembers
    .map((member) => member.contact)
    .filter((contact) => {
      if (contact === null || contact === undefined) {
        return false;
      }
      if (!matchText) {
        return true;
      }

      return (
        contact.id.match(new RegExp(matchText, 'i')) ||
        contact.nickname?.match(new RegExp(matchText, 'i'))
      );
    })
    .slice(0, 7);

  return (
    <ContactList>
      {subSet.map((contact) =>
        contact ? (
          <ContactList.Item
            alignItems="center"
            justifyContent="flex-start"
            onPress={() => onPress(contact)}
            // setting the width to the screen width - 40 so that we can use
            // ellipsizeMode="tail" to truncate the text
            width={Dimensions.get('window').width - 40}
            // this is a hack to make the text not overflow the container
            paddingRight="$3xl"
            padding="$s"
            key={contact.id}
            contact={contact}
            matchText={matchText ? desig(matchText) : undefined}
            showBoth
          />
        ) : null
      )}
    </ContactList>
  );
}
