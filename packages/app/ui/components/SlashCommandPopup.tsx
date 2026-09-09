import type { SlashCommandOption } from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import React, {
  PropsWithRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { ContactList } from './ContactList';
import { ListItem } from './ListItem';
import { useBoundHandler } from './listItems/listItemUtils';
import { toIconType } from './slashCommandIcon';

export interface SlashCommandController {
  handleSlashCommandKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
}
export type SlashCommandPopupRef =
  React.RefObject<SlashCommandController | null>;

function SlashCommandOptionItem({
  selected,
  option,
  onPress,
}: {
  selected: boolean;
  option: SlashCommandOption;
  onPress: (option: SlashCommandOption) => void;
}) {
  const handlePress = useBoundHandler(option, onPress);
  const icon = toIconType(option.icon);
  const subtitle = option.subtitle
    ? `${option.command} · ${option.subtitle}`
    : option.command;

  return (
    <Pressable
      borderRadius="$xl"
      onPress={handlePress}
      data-testid={`${option.command}-slash-command`}
    >
      <ListItem
        alignItems="center"
        justifyContent="flex-start"
        paddingRight="$3xl"
        padding="$s"
        backgroundColor={selected ? '$positiveBackground' : 'unset'}
      >
        <ListItem.SystemIcon icon={icon} size="$4xl" />
        <ListItem.MainContent>
          <ListItem.Title>{option.title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>
    </Pressable>
  );
}

function SlashCommandPopupInternal(
  {
    options,
    onPress,
  }: PropsWithRef<{
    options: SlashCommandOption[];
    onPress: (option: SlashCommandOption) => void;
  }>,
  ref: React.Ref<SlashCommandController>
) {
  const maxResults = Platform.OS === 'web' ? 7 : 4;
  const subSet = useMemo(
    () => options.slice(0, maxResults),
    [options, maxResults]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when the visible options change — keyed on the command
  // identities, not the length, so a same-length filter change still resets.
  const subSetKey = useMemo(
    () => subSet.map((o) => o.command).join(' '),
    [subSet]
  );
  useEffect(() => {
    setSelectedIndex(0);
  }, [subSetKey]);

  useImperativeHandle(ref, () => ({
    handleSlashCommandKey(key) {
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
          if (subSet[selectedIndex]) {
            onPress(subSet[selectedIndex]);
          }
          break;
      }
    },
  }));

  if (subSet.length === 0) {
    return null;
  }

  return (
    <ContactList testID="SlashCommandPopup">
      {subSet.map((option, index) => {
        return (
          <SlashCommandOptionItem
            key={option.command}
            selected={index === selectedIndex && Platform.OS === 'web'}
            option={option}
            onPress={onPress}
          />
        );
      })}
    </ContactList>
  );
}

const SlashCommandPopup = React.forwardRef(SlashCommandPopupInternal);
export default SlashCommandPopup;
