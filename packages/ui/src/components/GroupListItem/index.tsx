import type { ClientTypes as Client } from "@tloncorp/shared";
import { ListItem, type ListItemProps } from "../ListItem";
import { useCallback, useMemo } from "react";
import ListItemContent from "./ListItemContent";

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

  return (
    <ListItemContent
      model={model}
      onPress={handlePress}
      onLongPress={handleLongPress}
    />
  );
};
