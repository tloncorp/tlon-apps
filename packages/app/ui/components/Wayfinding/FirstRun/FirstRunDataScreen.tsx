import { Text } from '@tloncorp/ui';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';

import {
  LineButton,
  LineStepFrame,
  LineTextLink,
} from '../../Onboarding/line/LineStepFrame';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.dataKept;
/** The list starts lower under the subtitle than a drawing would. */
const SUBTITLE_TO_LIST_GAP = 47;
const ITEM_GAP = 22;
/** The FAQ link sits this far above Done. */
const LINK_TO_BUTTON_GAP = 24;

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
      subtitle={copy.subtitle}
      contentGap={SUBTITLE_TO_LIST_GAP}
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
          <YStack key={item.label} gap={4} accessible>
            <Text fontSize={13} lineHeight={18} color="$secondaryText">
              {item.label}
            </Text>
            <Text
              fontSize={16}
              lineHeight={22}
              letterSpacing={-0.2}
              color="$primaryText"
            >
              {item.text}
            </Text>
          </YStack>
        ))}
      </YStack>
    </LineStepFrame>
  );
}
