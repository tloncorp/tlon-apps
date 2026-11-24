import { Text } from '@tloncorp/ui';
import { Linking } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import {
  LineStepFrame,
  LineTextLink,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.dataKept;
/**
 * The FAQ link reads as a subtitle: its tap area reaches this far up into
 * the title's line.
 */
const FAQ_LINK_OVERLAP = 2;
/** The list starts this far under the link's tap area. */
const FAQ_LINK_TO_LIST_GAP = 23;
const ITEM_GAP = 18;

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
      contentGap={-FAQ_LINK_OVERLAP}
      primary={{
        label: copy.primary,
        onPress: onBack,
        testID: 'first-run-data-done',
      }}
      testID="first-run-data"
    >
      <LineTextLink
        label={copy.faqLink}
        onPress={() => {
          Linking.openURL(copy.faqUrl).catch(() => {});
        }}
        testID="first-run-data-faqs"
      />
      <YStack
        marginTop={FAQ_LINK_TO_LIST_GAP}
        marginHorizontal={28}
        gap={ITEM_GAP}
      >
        {copy.items.map((item) => (
          <XStack
            key={item.title}
            gap={14}
            alignItems="flex-start"
            accessible
            accessibilityLabel={`${item.title}. ${item.text}`}
          >
            <View marginTop={1}>
              <LineIcon name={item.icon} />
            </View>
            <YStack flex={1} gap={2}>
              <Text
                fontSize={16}
                lineHeight={22}
                letterSpacing={-0.2}
                color="$primaryText"
              >
                {item.title}
              </Text>
              <Text
                fontSize={14}
                lineHeight={20}
                letterSpacing={-0.1}
                color="$secondaryText"
              >
                {item.text}
              </Text>
            </YStack>
          </XStack>
        ))}
      </YStack>
    </LineStepFrame>
  );
}
