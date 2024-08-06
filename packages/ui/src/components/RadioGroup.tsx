import { useCallback } from 'react';
import { Circle, YStack, styled, withStaticProperties } from 'tamagui';

import { Icon } from './Icon';
import { ListItem } from './ListItem';

const RadioGroupFrame = styled(YStack);

function RadioGroupOption(props: {
  label: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  const handlePress = useCallback(() => {
    if (!props.selected) {
      props.onSelect(props.value);
    }
  }, [props]);

  return (
    <ListItem onPress={handlePress}>
      <ListItem.MainContent>
        <ListItem.Title>{props.label}</ListItem.Title>
      </ListItem.MainContent>
      <ListItem.EndContent>
        {props.selected ? (
          <Icon type="Checkmark" />
        ) : (
          <Circle size="$l" borderWidth={1} borderColor="$border" />
        )}
      </ListItem.EndContent>
    </ListItem>
  );
}

export const RadioGroup = withStaticProperties(RadioGroupFrame, {
  Option: RadioGroupOption,
});
