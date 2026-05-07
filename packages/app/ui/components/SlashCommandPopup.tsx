import { type IconType, Pressable } from '@tloncorp/ui';
import React, {
  PropsWithRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { type SlashCommandOption } from './BareChatInput/useSlashCommands';
import { ContactList } from './ContactList';
import { ListItem } from './ListItem';
import { useBoundHandler } from './listItems/listItemUtils';

export interface SlashCommandController {
  handleSlashCommandKey(key: 'ArrowUp' | 'ArrowDown' | 'Enter'): void;
}
export type SlashCommandPopupRef = React.RefObject<SlashCommandController>;

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
  const icon = option.icon as IconType;
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
  const subSet = useMemo(() => options.slice(0, 7), [options]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [subSet.length]);

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
    <ContactList>
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
