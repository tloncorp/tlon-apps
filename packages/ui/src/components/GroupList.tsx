import { SectionList, StyleProp, ViewStyle } from "react-native";
import type { ClientTypes } from "@tloncorp/shared";
import { GroupListItem } from "./GroupListItem";
import { Text, useStyle } from "../core";

export function GroupList({
  pinned,
  other,
  onGroupLongPress,
  onGroupPress,
}: {
  pinned: ClientTypes.Group[];
  other: ClientTypes.Group[];
  onGroupPress?: (group: ClientTypes.Group) => void;
  onGroupLongPress?: (group: ClientTypes.Group) => void;
}) {
  const contentContainerStyle = useStyle(
    {
      gap: "$s",
      padding: "$l",
    },
    { resolveValues: "value" }
    // Shouldn't have to cast this, since gap and padding will resolve to
    // numeric values, but I think tamagui's types are off here.
  ) as StyleProp<ViewStyle>;

  return (
    <SectionList
      sections={[
        ...(pinned.length > 0
          ? [{ name: "Pinned", data: Array.from(pinned) }]
          : []),
        {
          name: pinned.length > 0 ? "Other" : undefined,
          data: Array.from(other),
        },
      ]}
      renderItem={({ item }) => (
        <GroupListItem
          model={item}
          onPress={() => onGroupPress?.(item)}
          onLongPress={() => onGroupLongPress?.(item)}
        />
      )}
      renderSectionHeader={({ section }) =>
        section.name ? (
          <Text
            paddingHorizontal="$l"
            paddingVertical="$xl"
            fontSize={"$s"}
            color="$secondaryText"
          >
            {section.name}
          </Text>
        ) : null
      }
      stickySectionHeadersEnabled={false}
      contentContainerStyle={contentContainerStyle}
      keyExtractor={getGroupId}
    />
  );
}

function getGroupId(group: ClientTypes.Group) {
  return group.id;
}
