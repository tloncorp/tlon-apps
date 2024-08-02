import * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';
import { TouchableOpacity } from 'react-native';

import { SizableText, XStack, YStack } from '../core';
import { GroupPreviewSheet } from './GroupPreviewSheet';
import { GroupListItem, ListItem } from './ListItem';
import { WidgetPane } from './WidgetPane';

export function FavoriteGroupsDisplay(props: {
  groups: db.Group[];
  editable?: boolean;
  onRemove?: (group: db.Group) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  return (
    <WidgetPane>
      <WidgetPane.Title marginLeft="$s" marginBottom="$s">
        Favorite Groups
      </WidgetPane.Title>
      {props.groups.length === 0 ? (
        <XStack marginVertical="$2xl" justifyContent="center">
          <SizableText color="$tertiaryText">No favorites</SizableText>
        </XStack>
      ) : (
        props.groups.map((group) => {
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
