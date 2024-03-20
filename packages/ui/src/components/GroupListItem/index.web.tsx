import type { ClientTypes as Client } from "@tloncorp/shared";
import { ListItem, type ListItemProps } from "../ListItem";
import { useCallback, useMemo } from "react";
import { useLongPress } from "@uidotdev/usehooks";
import { Icon } from "../Icon";
import ListItemContent from "./ListItemContent";

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<Client.Group>) => {
  const attributes = useLongPress(
    () => {
      onLongPress?.(model);
    },
    { threshold: 600 }
  );

  return (
    <div {...attributes}>
      <ListItemContent model={model} onPress={onPress} />
    </div>
  );
};
