import type { PersonalityOption } from '@tloncorp/shared/domain';
import { Icon } from '@tloncorp/ui';

import { ListItem } from './ListItem';

interface Props {
  option: PersonalityOption;
  selected: boolean;
  onPress: () => void;
}

export function PersonalityCard({ option, selected, onPress }: Props) {
  return (
    <ListItem
      onPress={onPress}
      backgroundColor={selected ? '$positiveBackground' : '$background'}
      borderWidth={1}
      borderColor={selected ? '$positiveActionText' : '$border'}
    >
      <ListItem.MainContent>
        <ListItem.Title
          color={selected ? '$positiveActionText' : '$primaryText'}
        >
          {option.title}
        </ListItem.Title>
        <ListItem.Subtitle
          color={selected ? '$positiveActionText' : '$secondaryText'}
        >
          {option.description}
        </ListItem.Subtitle>
      </ListItem.MainContent>
      {selected && (
        <ListItem.EndContent>
          <Icon type="Checkmark" color="$positiveActionText" />
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}
