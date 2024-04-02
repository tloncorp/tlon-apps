import { Input, XStack } from 'tamagui';

import { Button } from './Button';

export function SearchBar() {
  return (
    <XStack>
      <Input
        backgroundColor="$secondaryBackground"
        placeholder="Search Internet Cafe"
        paddingHorizontal="$m"
        paddingVertical="$space.m"
        borderWidth={2}
        padding={4}
        color="$black"
      />
      <Button minimal>
        <Button.Text>Cancel</Button.Text>
      </Button>
    </XStack>
  );
}
