import { SizableText, Stack } from '../core';

export function Badge({
  text,
  type = 'positive',
}: {
  text: string;
  type?: 'positive' | 'warning';
}) {
  return (
    <Stack
      backgroundColor={
        type === 'positive' ? '$positiveBackground' : '$orangeSoft'
      }
      paddingVertical="$xs"
      paddingHorizontal="$l"
      borderRadius="$xl"
    >
      <SizableText
        size="$s"
        color={type === 'positive' ? '$positiveActionText' : '$orange'}
      >
        {text}
      </SizableText>
    </Stack>
  );
}
