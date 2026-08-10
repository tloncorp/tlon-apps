import { Input } from '@tloncorp/ui';
import { debounce } from 'lodash';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

  // A trailing debounce outlives the component that scheduled it: closing a
  // search overlay or leaving a screen mid-type otherwise lets a queued query
  // land on a consumer that has already reset its state.
  //
  // Held in a ref and cancelled with empty deps so this fires on unmount only.
  // Keying it to the memo's identity would cancel the pending call every time
  // a caller passed an unstable onChangeQuery — silently defeating the debounce
  // rather than just cleaning up after it.
  const pendingQueryRef = useRef(debouncedOnChangeQuery);
  useEffect(() => {
    pendingQueryRef.current = debouncedOnChangeQuery;
  }, [debouncedOnChangeQuery]);
  useEffect(() => () => pendingQueryRef.current.cancel(), []);

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
      } else if (debounceTime <= 0) {
        // Some callers, like the forward sheet picker, want truly immediate
        // search updates rather than going through the debounce wrapper.
        debouncedOnChangeQuery.cancel();
        onChangeQuery(newValue);
      } else {
        debouncedOnChangeQuery(newValue);
      }
    },
    [debounceTime, debouncedOnChangeQuery, onChangeQuery]
  );

  return (
    <YStack flexGrow={1} alignItems="center" {...rest}>
      <TextInput
        frameStyle={{ width: '100%' }}
        icon="Search"
        value={value}
        onChangeText={onTextChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCorrect={false}
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
