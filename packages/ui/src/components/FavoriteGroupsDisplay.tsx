import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { useGroups } from '../contexts';
import { SizableText, XStack } from '../core';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import { GroupPreviewSheet } from './GroupPreviewSheet';
import { GroupSelectorSheet } from './GroupSelectorSheet';
import { GroupListItem, ListItem } from './ListItem';
import { WidgetPane } from './WidgetPane';

export function FavoriteGroupsDisplay(props: {
  groups: db.Group[];
  editable?: boolean;
  secondaryColors?: boolean;
  onUpdate?: (groups: db.Group[]) => void;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);

  // if editable, get sorted groups to pass to the selector
  const allGroups = useGroups();
  const titledGroups = useMemo(() => {
    if (!props.editable) return [];
    return allGroups?.filter((g) => !!g.title) ?? [];
  }, [allGroups, props.editable]);
  const alphaSegmentedGroups = useAlphabeticallySegmentedGroups({
    groups: titledGroups,
    enabled: props.editable,
  });

  // first, make sure we grab group previews. We have no guarantee that our
  // Urbit has ever heard about these
  useEffect(() => {
    if (props.groups.length && !props.editable) {
      const groupIds = props.groups
        .map((g) => g && g.id)
        .filter(Boolean) as string[];
      store.syncGroupPreviews(groupIds);
    }
  }, [props.editable, props.groups]);

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
    <WidgetPane
      backgroundColor={
        props.secondaryColors ? '$secondaryBackground' : '$background'
      }
    >
      <WidgetPane.Title
        marginLeft="$s"
        marginBottom="$s"
        color={props.secondaryColors ? '$secondaryText' : '$tertiaryText'}
      >
        Favorite Groups
      </WidgetPane.Title>
      {compositeGroups.length === 0 ? (
        <></>
      ) : (
        compositeGroups.map((group) => {
          return (
            <GroupListItem
              model={group}
              padding="$m"
              key={group.id}
              backgroundColor="unset"
              onPress={() => setSelectedGroup(group)}
              pressStyle={{
                backgroundColor: props.secondaryColors
                  ? '$gray100'
                  : '$secondaryBackground',
              }}
              EndContent={
                props.editable ? (
                  <TouchableOpacity
                    onPress={() => handleFavoriteGroupsChange(group)}
                  >
                    <ListItem.EndContent>
                      <ListItem.SystemIcon
                        icon="Close"
                        backgroundColor="unset"
                        color={
                          props.secondaryColors
                            ? '$secondaryText'
                            : '$tertiaryText'
                        }
                      />
                    </ListItem.EndContent>
                  </TouchableOpacity>
                ) : null
              }
            />
          );
        })
      )}
      {props.editable && (
        <>
          <ListItem
            padding="$m"
            onPress={() => setSelectorOpen(true)}
            backgroundColor="unset"
            pressStyle={{
              backgroundColor: props.secondaryColors
                ? '$gray100'
                : '$secondaryBackground',
            }}
          >
            <ListItem.SystemIcon
              icon="Add"
              backgroundColor="unset"
              color={props.secondaryColors ? '$secondaryText' : '$tertiaryText'}
            />
            <ListItem.MainContent>
              <ListItem.Title>Add a group</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent backgroundColor="unset">
              <ListItem.SystemIcon
                icon="ChevronRight"
                backgroundColor="unset"
                color={
                  props.secondaryColors ? '$secondaryText' : '$tertiaryText'
                }
              />
            </ListItem.EndContent>
          </ListItem>
          <GroupSelectorSheet
            open={selectorOpen}
            onOpenChange={setSelectorOpen}
            alphaSegmentedGroups={alphaSegmentedGroups}
            selected={props.groups.map((g) => g.id)}
            onSelect={handleFavoriteGroupsChange}
            TopContent={SheetTopContent}
          />
        </>
      )}
      {selectedGroup && (
        <GroupPreviewSheet
          open={!!selectedGroup}
          onOpenChange={() => setSelectedGroup(null)}
          group={selectedGroup}
        />
      )}
    </WidgetPane>
  );
}
