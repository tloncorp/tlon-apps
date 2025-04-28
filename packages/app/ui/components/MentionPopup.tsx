import * as db from '@tloncorp/shared/db';
import { desig } from '@tloncorp/shared/urbit';
import {
  PropsWithRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import React from 'react';
import { Platform } from 'react-native';

import { ContactList } from './ContactList';

export interface MentionController {
  handleMentionKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
}
export type MentionPopupRef = React.RefObject<MentionController>;

function MentionPopupInternal(
  {
    groupMembers,
    onPress,
    matchText,
    setHasMentionCandidates,
  }: PropsWithRef<{
    groupMembers: db.ChatMember[];
    onPress: (contact: db.Contact) => void;
    matchText?: string;
    setHasMentionCandidates?: (has: boolean) => void;
  }>,
  ref: React.Ref<{
    handleMentionKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
  }>
) {
  const subSet = useMemo(
    () =>
      groupMembers
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
        .slice(0, 7),
    [groupMembers, matchText]
  );

  const subsetSize = useMemo(() => subSet.length, [subSet]);

  useEffect(() => {
    setHasMentionCandidates?.(subsetSize > 0);
  }, [subsetSize, setHasMentionCandidates]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [subsetSize]);

  useImperativeHandle(ref, () => ({
    handleMentionKey(key) {
      switch (key) {
        case 'ArrowUp':
          setSelectedIndex((prevIndex) =>
            prevIndex > 0 ? prevIndex - 1 : prevIndex
          );
          break;
        case 'ArrowDown':
          setSelectedIndex((prevIndex) =>
            prevIndex < subsetSize - 1 ? prevIndex + 1 : prevIndex
          );
          break;
        case 'Enter':
          onPress(subSet[selectedIndex]!);
          break;
        default:
          break;
      }
    },
  }));

  if (subSet.length === 0) {
    return null;
  }

  return (
    <ContactList>
      {subSet.map((contact, index) =>
        contact ? (
          <ContactList.Item
            alignItems="center"
            justifyContent="flex-start"
            onPress={() => onPress(contact)}
            // setting the width to the screen width - 40 so that we can use
            // ellipsizeMode="tail" to truncate the text
            // width={Dimensions.get('window').width - 40}
            // this is a hack to make the text not overflow the container
            paddingRight="$3xl"
            padding="$s"
            key={contact.id}
            contactId={contact.id}
            matchText={matchText ? desig(matchText) : undefined}
            showNickname
            showUserId
            backgroundColor={
              Platform.OS === 'web' && index === selectedIndex
                ? '$positiveBackground'
                : 'unset'
            }
          />
        ) : null
      )}
    </ContactList>
  );
}

const MentionPopup = React.forwardRef(MentionPopupInternal);
export default MentionPopup;
