import { debounce } from 'lodash';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Circle, View } from 'tamagui';

import { TextInput } from './Form';
import { Icon } from './Icon';
import { Input } from './Input';
import Pressable from './Pressable';

export function SearchBar({
  placeholder,
  onChangeQuery,
  debounceTime = 300,
  inputProps,
  ...rest
}: {
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceTime?: number;
  inputProps?: ComponentProps<typeof TextInput>;
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
      {...rest}
    >
      <TextInput
        icon="Search"
        value={value}
        onChangeText={onTextChange}
        placeholder={placeholder}
        {...inputProps}
      />
      <Pressable
        onPress={() => onTextChange('')}
        alignItems="center"
        position="absolute"
        right={'$3xl'}
        top={18}
        pressStyle={{ backgroundColor: 'unset' }}
        height="100%"
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
      </Pressable>
    </View>
  );
}
