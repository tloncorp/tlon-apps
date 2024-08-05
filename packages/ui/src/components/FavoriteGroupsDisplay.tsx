import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { SizableText, XStack } from '../core';
import { GroupPreviewSheet } from './GroupPreviewSheet';
import { GroupListItem, ListItem } from './ListItem';
import { WidgetPane } from './WidgetPane';

export function FavoriteGroupsDisplay(props: {
  groups: db.Group[];
  editable?: boolean;
  onRemove?: (group: db.Group) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);

  // first, make sure we grab group previews. We have no guarantee that our
  // Urbit has ever heard about these
  useEffect(() => {
    if (props.groups.length) {
      const groupIds = props.groups
        .map((g) => g && g.id)
        .filter(Boolean) as string[];
      store.syncGroupPreviews(groupIds);
    }
  }, [props.groups]);

  // then, make sure we load up to date groups since the passed in ones
  // may not include table deps on updates to the group metadata
  const { data: previews } = store.useGroupPreviews(
    props.groups.map((g) => g.id)
  );

  // finally, make sure what we display is the up to date values, falling back
  // to what was passed in
  const compositeGroups = useMemo(() => {
    const result: Map<string, db.Group> = new Map();
    props.groups.forEach((g) => {
      const preview = previews?.find((p) => p.id === g.id);
      result.set(g.id, preview ?? g);
    });
    return Array.from(result.values());
  }, [props.groups, previews]);

  return (
    <WidgetPane>
      <WidgetPane.Title marginLeft="$s" marginBottom="$s">
        Favorite Groups
      </WidgetPane.Title>
      {compositeGroups.length === 0 ? (
        <XStack marginVertical="$2xl" justifyContent="center">
          <SizableText color="$tertiaryText">No favorites</SizableText>
        </XStack>
      ) : (
        compositeGroups.map((group) => {
          return (
            <GroupListItem
              model={group}
              padding="$m"
              key={group.id}
              backgroundColor="unset"
              onPress={() => setSelectedGroup(group)}
              EndContent={
                props.editable ? (
                  <TouchableOpacity onPress={() => props.onRemove?.(group)}>
                    <ListItem.EndContent>
                      <ListItem.SystemIcon
                        icon="Close"
                        backgroundColor="unset"
                        color="$tertiaryText"
                      />
                    </ListItem.EndContent>
                  </TouchableOpacity>
                ) : null
              }
            />
          );
        })
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
