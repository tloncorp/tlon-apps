import { debounce } from 'lodash';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { Input as TInput, View } from 'tamagui';

import { Circle } from '../core';
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

  const onTextChange = useCallback((text: string) => {
    // we update the input display immediately, but debounce for consumers
    // of the search bar
    setValue(text);
    debouncedOnChangeQuery(text.trim());
  }, []);

  return (
    <View
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Input size="$m" {...rest} search>
        <Input.Icon>
          <Icon type="Search" color="$secondaryText" />
        </Input.Icon>

        <Input.Area
          placeholder={placeholder ?? 'Search...'}
          value={value}
          onChangeText={onTextChange}
          {...areaProps}
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
