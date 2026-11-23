import { Text } from '@tloncorp/ui';
import { Linking } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import {
  LineButton,
  LineStepFrame,
  LineTextLink,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.dataKept;
/** With no subtitle, the list starts this far under the title. */
const TITLE_TO_LIST_GAP = 33;
const ITEM_GAP = 22;
const ICON_SIZE = 20;
/** The FAQ link sits this far above Done. */
const LINK_TO_BUTTON_GAP = 14;

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
      contentGap={TITLE_TO_LIST_GAP}
      footer={
        <YStack paddingHorizontal="$2xl">
          <LineTextLink
            label={copy.faqLink}
            onPress={() => {
              Linking.openURL(copy.faqUrl).catch(() => {});
            }}
            testID="first-run-data-faqs"
          />
          <YStack marginTop={LINK_TO_BUTTON_GAP}>
            <LineButton
              label={copy.primary}
              onPress={onBack}
              testID="first-run-data-done"
            />
          </YStack>
        </YStack>
      }
      testID="first-run-data"
    >
      <YStack marginHorizontal={28} gap={ITEM_GAP}>
        {copy.items.map((item) => (
          <XStack
            key={item.title}
            gap={14}
            alignItems="flex-start"
            accessible
            accessibilityLabel={`${item.title}. ${item.text}`}
          >
            <View marginTop={1}>
              <LineIcon name={item.icon} size={ICON_SIZE} strokeWidth={1.3} />
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
