import { Icon, Pressable } from '@tloncorp/ui';
import { XStack } from 'tamagui';

import { Badge } from '../Badge';
import { ListItem } from '../ListItem';

/**
 * A single-select row used by the splash panes that ask the user to pick one
 * of a few things — provider, model, starter template.
 *
 * Description and recommendation are independent: an option can carry both,
 * which the starter picker needs so the recommended choice still explains
 * itself. The badge sits beside the title rather than under it because
 * ListItem.MainContent is a fixed two-line height — a third stacked row
 * overflows and collides with the description.
 */
export function SplashOptionCard({
  option,
  selected,
  onPress,
  testID,
}: {
  option: {
    label: string;
    description?: string;
    recommendationLabel?: string;
  };
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress}>
      <ListItem
        backgroundColor={selected ? '$secondaryBackground' : '$background'}
        borderWidth={1}
        borderColor={selected ? '$primaryText' : '$border'}
      >
        <ListItem.MainContent>
          <XStack alignItems="center" gap="$s">
            <ListItem.Title color="$primaryText" flexShrink={1}>
              {option.label}
            </ListItem.Title>
            {option.recommendationLabel ? (
              <Badge
                text={option.recommendationLabel}
                type="positive"
                size="micro"
                flexShrink={0}
              />
            ) : null}
          </XStack>
          {option.description ? (
            <ListItem.Subtitle color="$secondaryText">
              {option.description}
            </ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
        {selected && (
          <ListItem.EndContent>
            <Icon type="Checkmark" color="$primaryText" />
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
}
