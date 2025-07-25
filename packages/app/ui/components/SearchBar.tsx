import { Input } from '@tloncorp/ui';
import { debounce } from 'lodash';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { YStack } from 'tamagui';

import { TextInput } from './Form';

export function SearchBar({
  autoFocus = false,
  placeholder,
  onChangeQuery,
  debounceTime = 300,
  onPressCancel,
  inputProps,
  ...rest
}: {
  autoFocus?: boolean;
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceTime?: number;
  onPressCancel?: () => void;
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
    <YStack flexGrow={1} justifyContent="center" alignItems="center" {...rest}>
      <TextInput
        frameStyle={{ width: '100%' }}
        icon="Search"
        value={value}
        onChangeText={onTextChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rightControls={
          value !== '' || onPressCancel ? (
            <TextInput.InnerButton
              label={value === '' && !!onPressCancel ? 'Cancel' : 'Clear'}
              onPress={() =>
                value === '' && !!onPressCancel
                  ? onPressCancel()
                  : onTextChange('')
              }
            />
          ) : null
        }
        {...inputProps}
      />
    </YStack>
  );
}
