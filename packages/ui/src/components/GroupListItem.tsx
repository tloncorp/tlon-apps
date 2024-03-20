import type { ClientTypes as Client } from "@tloncorp/shared";
import { ListItem, type ListItemProps } from "./ListItem";
import { useCallback, useMemo } from "react";
import { Icon } from "./Icon";

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<Client.Group>) => {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress, model]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [onLongPress, model]);

  const unreadCount = useMemo(() => {
    // return db.getUnreadChannelCount(model);
    return 4;
  }, [model]);

  const lastPostAt = useMemo(() => {
    return new Date("2024-01-01 20:38:00");
  }, []);

  return (
    <ListItem {...props} onPress={handlePress} onLongPress={handleLongPress}>
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor}
        imageUrl={model.iconImage}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        {/* <ListItem.Subtitle>{model.latestPost?.text}</ListItem.Subtitle> */}
        <ListItem.Subtitle>
          Here's some content, it's a message
        </ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" bottom={6}>
        {true ? (
          <ListItem.Time>
            {/* {new Date(model.lastPostAt).toLocaleDateString()} */}
            {lastPostAt.toLocaleDateString()}
          </ListItem.Time>
        ) : null}
        {unreadCount > 0 ? (
          <ListItem.Count>{unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
};
