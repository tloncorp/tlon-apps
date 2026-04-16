import { Text } from '@tloncorp/ui';

export function HiddenPhoneDisplay() {
  return (
    <Text size="$label/l" fontWeight="500">
      (
      <Text size="$label/xl" fontWeight="600">
        ···
      </Text>
      ){' '}
      <Text size="$label/xl" fontWeight="600">
        ··· ····
      </Text>
    </Text>
  );
}
