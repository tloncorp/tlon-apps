import * as db from '@tloncorp/shared/dist/db';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionListRenderItemInfo,
} from 'react-native';

import { Stack, View, YStack } from '../core';
import { AlphaSegmentedGroups } from '../hooks/groupsSorters';
import { triggerHaptic } from '../utils';
import { Icon } from './Icon';
import { GroupListItem, ListItem } from './ListItem';
import { BlockSectionList } from './SectionList';
import { Sheet } from './Sheet';

interface Props {
  onSelect?: (group: db.Group) => void;
  multiSelect?: boolean;
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
      // if (props.multiSelect) {
      //   const selected = props.selected ?? [];
      //   if (selected.includes(groupId)) {
      //     const newSelected = selected.filter((id) => id !== groupId);
      //     props.onSelectedChange?.(newSelected);
      //   } else {
      //     const newSelected = [...selected, groupId];
      //     props.onSelectedChange?.(newSelected);
      //   }
      // } else {
      //   props.onSelect?.(groupId);
      // }
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

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelected?: string[];
  selected?: string[];
  onSelect?: (group: db.Group) => void;
  alphaSegmentedGroups: AlphaSegmentedGroups;
  TopContent?: React.ReactNode;
}
export function GroupSelectorSheet(props: SheetProps) {
  const [contentScrolling, setContentScrolling] = useState(false);

  useEffect(() => {
    if (props.open) {
      triggerHaptic('sheetOpen');
    }
  }, [props.open]);

  return (
    <Sheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      snapPoints={[85]}
      modal
      disableDrag={contentScrolling}
      dismissOnSnapToBottom
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.LazyFrame paddingTop="$s" paddingHorizontal="$2xl">
        <Sheet.Handle marginBottom="$l" />
        <YStack flex={1} gap="$2xl">
          {props.TopContent}
          <GroupSelector
            multiSelect
            selected={props.selected}
            onSelect={props.onSelect}
            onScrollChange={setContentScrolling}
            alphaSegmentedGroups={props.alphaSegmentedGroups}
          />
        </YStack>
      </Sheet.LazyFrame>
    </Sheet>
  );
}
