import { Icon, Pressable } from '@tloncorp/ui';

import { Badge } from '../Badge';
import { ListItem } from '../ListItem';

/**
 * A single-select row used by the splash panes that ask the user to pick one
 * of a few things — provider, model, starter template.
 *
 * Description and recommendation are independent: an option can carry both,
 * which the starter picker needs so the recommended choice still explains
 * itself.
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
          <ListItem.Title color="$primaryText">{option.label}</ListItem.Title>
          {option.description ? (
            <ListItem.Subtitle color="$secondaryText">
              {option.description}
            </ListItem.Subtitle>
          ) : null}
          {option.recommendationLabel ? (
            <Badge
              text={option.recommendationLabel}
              type="positive"
              size="micro"
              alignSelf="flex-start"
              marginTop="$m"
            />
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
