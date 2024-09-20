import { debounce } from 'lodash';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Input as TInput, View, XStack } from 'tamagui';
import { Circle } from 'tamagui';

import { TextInputWithIcon } from './Form';
import { Icon } from './Icon';
import { Input } from './Input';

export function SearchBar({
  placeholder,
  onChangeQuery,
  debounceTime = 300,
  areaProps,
  ...rest
}: {
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceTime?: number;
  areaProps?: ComponentProps<typeof TInput>;
} & ComponentProps<typeof Input>) {
  const [value, setValue] = useState('');
  const debouncedOnChangeQuery = useMemo(
    () =>
      debounce(onChangeQuery, debounceTime, {
        leading: false,
        trailing: true,
      }),
    [debounceTime, onChangeQuery]
  );

  const onTextChange = useCallback(
    (text: string) => {
      // we update the input display immediately, but debounce for consumers
      // of the search bar
      setValue(text);
      const newValue = text.trim();
      if (newValue === '') {
        // if value was cleared, update immediately
        debouncedOnChangeQuery.cancel();
        onChangeQuery('');
      } else {
        debouncedOnChangeQuery(newValue);
      }
    },
    [debouncedOnChangeQuery, onChangeQuery]
  );

  return (
    <View
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <TextInputWithIcon
        icon="Search"
        value={value}
        onChangeText={onTextChange}
        placeholder={placeholder}
      />
      <XStack
        alignItems="center"
        position="absolute"
        right={'$xl'}
        top={0}
        height="100%"
        onPress={() => onTextChange('')}
        disabled={value === ''}
        opacity={value === '' ? 0 : undefined}
      >
        <Circle
          justifyContent="center"
          alignItems="center"
          size="$xl"
          backgroundColor="$secondaryText"
        >
          <Icon size="$s" type="Close" color="$secondaryBackground" />
        </Circle>
      </XStack>
    </View>
  );
}
