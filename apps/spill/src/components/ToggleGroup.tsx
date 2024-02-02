import React, {ReactElement, useCallback, useMemo} from 'react';
import {SizableText, XStack} from '@ochre';

export interface ToggleGroupItemData<T> {
  label?: string;
  icon?: ReactElement;
  value: T;
}

export function ToggleGroup<T>({
  value,
  items,
  onChange,
  vertical,
}: {
  value: T;
  items: ToggleGroupItemData<T>[];
  onChange: (value: T) => void;
  vertical?: boolean;
}) {
  const handleItemPressed = useCallback(
    (newValue: T) => {
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <XStack
      flexDirection={vertical ? 'column' : 'row'}
      borderRadius={'$m'}
      borderColor={'$border'}
      overflow="hidden"
      borderWidth={1}>
      {items.map((item, index) => (
        <ToggleGroupItem
          key={index}
          item={item}
          selected={item.value === value}
          onPress={handleItemPressed}
          isFirst={index === 0}
          isLast={index === items.length - 1}
        />
      ))}
    </XStack>
  );
}

export interface ToggleGroupItemProps<T> {
  item: ToggleGroupItemData<T>;
  onPress: (value: T) => void;
  selected: boolean;
  isLast: boolean;
  isFirst: boolean;
}

export function ToggleGroupItem<T>({
  isFirst,
  item,
  selected,
  onPress,
}: ToggleGroupItemProps<T>) {
  const handlePress = useCallback(() => {
    onPress(item.value);
  }, [item.value, onPress]);
  const pressStyle = useMemo(() => {
    return {
      backgroundColor: '$secondaryBackground',
    } as const;
  }, []);
  return (
    <XStack
      flex={1}
      pressStyle={pressStyle}
      onPress={handlePress}
      borderColor={'$border'}
      borderLeftWidth={isFirst ? 0 : 1}
      padding={'$s'}
      alignItems="center"
      height="$xl"
      paddingHorizontal={'$l'}
      backgroundColor={selected ? '$secondaryBackground' : undefined}>
      <SizableText flex={1} textAlign="center">
        {item.icon && item.icon}
        {item.label}
      </SizableText>
    </XStack>
  );
}
