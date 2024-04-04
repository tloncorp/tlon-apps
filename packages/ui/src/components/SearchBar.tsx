import { debounce } from 'lodash';
import { useCallback, useState } from 'react';
import { SizeTokens, View } from 'tamagui';

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
    debouncedOnChangeQuery(text);
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

        <Input.Icon onPress={() => onTextChange('')}>
          <Icon size="$s" type="Close" color="$secondaryText" />
        </Input.Icon>
      </Input>
    </View>
  );
}
