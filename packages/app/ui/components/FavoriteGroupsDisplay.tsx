import * as db from '@tloncorp/shared/db';
import { Pressable } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { SizableText, XStack } from 'tamagui';

import { useGroups } from '../contexts';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import { GroupSelectorSheet } from './GroupSelectorSheet';
import { GroupListItem, ListItem } from './ListItem';
import { WidgetPane } from './WidgetPane';

export function FavoriteGroupsDisplay(props: {
  groups: db.Group[];
  onUpdate?: (groups: db.Group[]) => void;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  // if editable, get sorted groups to pass to the selector
  const allGroups = useGroups();
  const filteredGroups = useMemo(() => {
    return (
      allGroups?.filter(
        (g) => g.privacy !== 'secret' && g.currentUserIsMember === true
      ) ?? []
    );
  }, [allGroups]);

  const alphaSegmentedGroups = useAlphabeticallySegmentedGroups({
    groups: filteredGroups ?? [],
    enabled: true,
  });

  // finally, make sure what we display is the up to date values, falling back
  // to what was passed in
  const compositeGroups = useMemo(() => {
    const result: Map<string, db.Group> = new Map();
    props.groups.forEach((g) => {
      const preview = allGroups?.find((p) => p.id === g.id);
      result.set(g.id, preview ?? g);
    });
    return Array.from(result.values());
  }, [props.groups, allGroups]);

  const SheetTopContent = useMemo(() => {
    return (
      <XStack justifyContent="center">
        <SizableText size="$s" color="$tertiaryText">
          {props.groups.length >= 5
            ? `No more groups can be selected (max 5)`
            : `Choose up to ${5 - props.groups.length} more groups`}
        </SizableText>
      </XStack>
    );
  }, [props.groups.length]);

  const handleFavoriteGroupsChange = useCallback(
    (group: db.Group) => {
      const currentFaves = props.groups.map((g) => g.id);
      if (currentFaves.includes(group.id)) {
        props.onUpdate?.(props.groups.filter((g) => g.id !== group.id));
      } else {
        if (currentFaves.length >= 5) {
          // too many!
          return;
        }
        props.onUpdate?.([...props.groups, group]);
      }
    },
    [props]
  );

  return (
    <WidgetPane padding={'$m'} borderWidth={1} borderColor="$border">
      {compositeGroups.map((group) => {
        return (
          <GroupListItem
            model={group}
            key={group.id}
            disableOptions
            backgroundColor="unset"
            EndContent={
              <Pressable onPress={() => handleFavoriteGroupsChange(group)}>
                <ListItem.SystemIcon
                  icon="Close"
                  testID="ProfilePinnedGroupRemove"
                  onPress={() => handleFavoriteGroupsChange(group)}
                  backgroundColor={'transparent'}
                  color={'$tertiaryText'}
                />
              </Pressable>
            }
          />
        );
      })}
      <Pressable borderRadius="$xl" onPress={() => setSelectorOpen(true)}>
        <ListItem padding="$m" backgroundColor="unset">
          <ListItem.MainContent>
            <ListItem.Title>Add a group</ListItem.Title>
          </ListItem.MainContent>
          <ListItem.EndContent backgroundColor="unset">
            <ListItem.SystemIcon
              icon="ChevronRight"
              backgroundColor="unset"
              color={'$tertiaryText'}
            />
          </ListItem.EndContent>
        </ListItem>
      </Pressable>
      <GroupSelectorSheet
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        alphaSegmentedGroups={alphaSegmentedGroups}
        selected={props.groups.map((g) => g.id)}
        onSelect={handleFavoriteGroupsChange}
        onClose={() => setSelectorOpen(false)}
        TopContent={SheetTopContent}
      />
    </WidgetPane>
  );
}
