import { ComponentProps, useCallback, useState } from 'react';
import { SizeTokens, Text, View, XStack } from 'tamagui';

import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';

export function SearchBar({
  size,
  onChangeQuery,
}: {
  size?: SizeTokens;
  onChangeQuery: (query: string) => void;
}) {
  const [value, setValue] = useState('');

  const onTextChange = useCallback((text: string) => {
    setValue(text);
    onChangeQuery(text);
  }, []);

  return (
    <XStack paddingHorizontal="$l" gap="$l">
      <Input size={size} borderRadius="$m" backgroundColor="$color.gray100">
        <Input.Icon>
          <Icon type="Search" size="$m" color="$secondaryText" />
        </Input.Icon>

        <Input.Area
          placeholder="Search Internet Cafe"
          onChangeText={onTextChange}
        />

        <Input.Icon>
          <Icon type="Close" size="$s" color="$secondaryText" />
        </Input.Icon>
      </Input>

      <Button minimal>
        <Button.Text>Cancel</Button.Text>
      </Button>
    </XStack>
  );
}
