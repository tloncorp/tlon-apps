import { debounce } from 'lodash';
import { useCallback, useState } from 'react';
import { SizeTokens, View } from 'tamagui';

import { Circle } from '../core';
import { Icon } from './Icon';
import { Input } from './Input';

export function SearchBar({
  placeholder,
  size,
  onChangeQuery,
}: {
  placeholder?: string;
  size?: SizeTokens;
  onChangeQuery: (query: string) => void;
}) {
  const [value, setValue] = useState('');
  const debouncedOnChangeQuery = useCallback(
    debounce(
      (text: string) => {
        onChangeQuery(text);
      },
      300,
      { leading: false, trailing: true }
    ),
    []
  );

  const onTextChange = useCallback((text: string) => {
    // we update the input display immediately, but debounce for consumers
    // of the search bar
    setValue(text);
    debouncedOnChangeQuery(text.trim());
  }, []);

  return (
    <View
      flex={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Input size="$m" search>
        <Input.Icon>
          <Icon type="Search" color="$secondaryText" />
        </Input.Icon>

        <Input.Area
          placeholder={placeholder ?? 'Search...'}
          value={value}
          onChangeText={onTextChange}
        />

        <Input.Icon
          onPress={() => onTextChange('')}
          disabled={value === ''}
          opacity={value === '' ? 0 : undefined}
        >
          <Circle
            justifyContent="center"
            alignItems="center"
            size="$xl"
            backgroundColor="$color.gray500"
          >
            <Icon size="$s" type="Close" color="$color.gray100" />
          </Circle>
        </Input.Icon>
      </Input>
    </View>
  );
}
