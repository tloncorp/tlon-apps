import * as db from '@tloncorp/shared/db';
import React, { useCallback, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionListRenderItemInfo,
} from 'react-native';
import { Stack, View } from 'tamagui';

import { AlphaSegmentedGroups } from '../hooks/groupsSorters';
import { Icon } from './Icon';
import { GroupListItem, ListItem } from './ListItem';
import { BlockSectionList } from './SectionList';

interface Props {
  onSelect?: (group: db.Group) => void;
  selected?: string[];
  onScrollChange?: (scrolling: boolean) => void;
  alphaSegmentedGroups: AlphaSegmentedGroups;
}

export function GroupSelector(props: Props) {
  const scrollPosition = useRef(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    []
  );
  const onTouchStart = useCallback(() => {
    if (scrollPosition.current > 0) {
      props.onScrollChange?.(true);
    }
  }, [props]);

  const onTouchEnd = useCallback(() => props.onScrollChange?.(false), [props]);

  const handleSelect = useCallback(
    (group: db.Group) => {
      props.onSelect?.(group);
    },
    [props]
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<db.Group, { label: string }>) => {
      const isSelected = !!(props.selected ?? [])?.includes(item.id);
      return (
        <SelectableGroupItem
          group={item}
          selected={isSelected}
          selectable
          onPress={handleSelect}
        />
      );
    },
    [handleSelect, props]
  );

  return (
    <BlockSectionList
      sections={props.alphaSegmentedGroups}
      renderItem={renderItem}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onScroll={handleScroll}
    />
  );
}

function SelectableGroupItemComponent(props: {
  group: db.Group;
  selected: boolean;
  selectable: boolean;
  onPress?: (group: db.Group) => void;
}) {
  const handlePress = useCallback(() => {
    if (props.onPress) {
      props.onPress(props.group);
    }
  }, [props]);

  return (
    <GroupListItem
      model={props.group}
      backgroundColor="unset"
      onPress={handlePress}
      EndContent={
        props.selectable ? (
          <ListItem.EndContent>
            <Stack
              justifyContent="center"
              alignItems="center"
              height="$4xl"
              width="$4xl"
            >
              {props.selected ? (
                <Icon type="Checkmark" size="$xl" />
              ) : (
                <View
                  borderWidth={1}
                  borderRadius="$4xl"
                  borderColor="$tertiaryText"
                  opacity={0.6}
                  height="$3xl"
                  width="$3xl"
                />
              )}
            </Stack>
          </ListItem.EndContent>
        ) : null
      }
    />
  );
}
const SelectableGroupItem = React.memo(SelectableGroupItemComponent);
