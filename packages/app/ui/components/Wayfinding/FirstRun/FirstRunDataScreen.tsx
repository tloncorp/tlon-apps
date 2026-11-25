import { Text } from '@tloncorp/ui';
import { Linking } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import {
  LineIconTile,
  LineStepFrame,
  LineTextLink,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.dataKept;
const ITEM_GAP = 26;

/**
 * How your data is kept, opened from Yours to keep: where the Tlonbot runs
 * and who can see what. It's a side screen, so it shows no progress; Back and
 * Done both return to Yours to keep.
 */
export function FirstRunDataScreen({ onBack }: { onBack: () => void }) {
  return (
    <LineStepFrame
      onBack={onBack}
      title={copy.title}
      contentGap={36}
      primary={{
        label: copy.primary,
        onPress: onBack,
        testID: 'first-run-data-done',
      }}
      testID="first-run-data"
    >
      <YStack marginHorizontal={32} gap={ITEM_GAP}>
        {copy.items.map((item) => (
          <XStack
            key={item.title}
            gap={16}
            alignItems="flex-start"
            accessible
            accessibilityLabel={`${item.title}. ${item.text}`}
          >
            <LineIconTile>
              <LineIcon name={item.icon} size={24} />
            </LineIconTile>
            <YStack flex={1} gap={3}>
              <Text size="$label/xl" trimmed={false} color="$primaryText">
                {item.title}
              </Text>
              <Text size="$label/m" trimmed={false} color="$secondaryText">
                {item.text}
              </Text>
            </YStack>
          </XStack>
        ))}
      </YStack>
      <View marginTop={10}>
        <LineTextLink
          label={copy.faqLink}
          onPress={() => {
            Linking.openURL(copy.faqUrl).catch(() => {});
          }}
          testID="first-run-data-faqs"
        />
      </View>
    </LineStepFrame>
  );
}
