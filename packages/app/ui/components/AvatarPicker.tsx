import { SUGGESTED_AVATARS } from '@tloncorp/shared/domain';
import { Pressable } from '@tloncorp/ui';
import { Image, useWindowDimensions } from 'react-native';
import { View, getTokenValue } from 'tamagui';

interface Props {
  value: string | null;
  onSelect: (url: string | null) => void;
}

const COLUMNS = 4;

export function AvatarPicker({ value, onSelect }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const gap = getTokenValue('$s', 'size');
  const parentPadding = getTokenValue('$xl', 'size') * 2;
  const totalGap = gap * (COLUMNS - 1);
  const itemSize = Math.floor(
    (windowWidth - parentPadding - totalGap) / COLUMNS
  );

  return (
    <View flexDirection="row" flexWrap="wrap" gap="$s">
      {SUGGESTED_AVATARS.map((url) => (
        <Pressable key={url} onPress={() => onSelect(url)}>
          <View
            width={itemSize}
            height={itemSize}
            borderRadius="$s"
            borderWidth={2}
            borderColor={value === url ? '$positiveActionText' : '$border'}
            overflow="hidden"
          >
            <Image
              source={{ uri: url }}
              style={{ width: itemSize - 4, height: itemSize - 4 }}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
