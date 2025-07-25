import * as db from '@tloncorp/shared/db';
import { desig } from '@tloncorp/shared/urbit';
import { Pressable } from '@tloncorp/ui';
import {
  PropsWithRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import React from 'react';
import { Platform } from 'react-native';

import { MentionOption } from './BareChatInput/useMentions';
import { ContactList } from './ContactList';
import ContactName from './ContactName';
import { ListItem } from './ListItem/ListItem';
import { useBoundHandler } from './ListItem/listItemUtils';

export interface MentionController {
  handleMentionKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
}
export type MentionPopupRef = React.RefObject<MentionController>;

function MentionOptionItem({
  selected,
  matchText,
  option,
  onPress,
}: {
  selected: boolean;
  matchText?: string;
  option: MentionOption;
  onPress: (option: MentionOption) => void;
}) {
  const handlePress = useBoundHandler(option, onPress);
  const isContact = option.type === 'contact';
  const size = '$4xl';
  return (
    <Pressable
      borderRadius="$xl"
      onPress={handlePress}
      data-testid={`${option.id}-${option.type}`}
    >
      <ListItem
        alignItems="center"
        justifyContent="flex-start"
        paddingRight="$3xl"
        padding="$s"
        backgroundColor={selected ? '$positiveBackground' : 'unset'}
      >
        {isContact ? (
          <ListItem.ContactIcon size={size} contactId={option.id} />
        ) : (
          <ListItem.SystemIcon icon="Face" size={size} />
        )}
        <ListItem.MainContent>
          <ListItem.Title>
            {isContact ? (
              <ContactName
                matchText={matchText}
                showNickname
                userId={option.id}
              />
            ) : (
              option.title || option.id
            )}
          </ListItem.Title>
          {option.subtitle ? (
            <ListItem.Subtitle>{option.subtitle}</ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
      </ListItem>
    </Pressable>
  );
}

function MentionPopupInternal(
  {
    options,
    onPress,
    matchText,
  }: PropsWithRef<{
    options: MentionOption[];
    onPress: (option: MentionOption) => void;
    matchText?: string;
  }>,
  ref: React.Ref<{
    handleMentionKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
  }>
) {
  const subSet = useMemo(() => options.slice(0, 7), [options]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [subSet.length]);

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
            prevIndex < subSet.length - 1 ? prevIndex + 1 : prevIndex
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
      {subSet.map((option, index) => {
        return (
          <MentionOptionItem
            key={`${option.id}-${option.type}`}
            selected={index === selectedIndex && Platform.OS === 'web'}
            option={option}
            matchText={matchText}
            onPress={onPress}
          />
        );
      })}
    </ContactList>
  );
}

const MentionPopup = React.forwardRef(MentionPopupInternal);
export default MentionPopup;
