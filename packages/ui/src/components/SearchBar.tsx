import { ComponentProps, useState } from 'react';
import { SizeTokens, Text, View, XStack } from 'tamagui';

import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';

export function SearchBar({ size }: { size?: SizeTokens }) {
  return (
    <XStack paddingHorizontal="$l" gap="$l">
      <Input size={size} borderRadius="$m" backgroundColor="$color.gray100">
        <Input.Icon>
          <Icon type="Search" size="$m" color="$secondaryText" />
        </Input.Icon>

        <Input.Area placeholder="Search Internet Cafe" />

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
