import { TlonText } from '@tloncorp/ui';
import { PropsWithChildren, ReactNode } from 'react';
import { Platform, ScrollView } from 'react-native';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';

// Option rows on Notifications and step rows on the setup screen.
export const STEP_ROW_HEIGHT = 56;

const MAX_WIDTH = 600;
const BLOCK_GAP = 48;
// Body text takes at least two lines, so its first line stays put when the
// copy gets shorter.
const BODY_TWO_LINES = 48;

// Allow notifications used to show its permission prompt inside a full-screen
// picture (786 × 1704 px, scaled to cover the screen above the bottom inset).
// On phones the prompt stays exactly where that put it, and the other steps
// line up to it: their options or steps start at its top edge.
const HINT_IMAGE = { width: 786, height: 1704 };
const PROMPT_CROP = Platform.select({
  ios: { x: 94, y: 614, width: 600, height: 552 },
  default: { x: 58, y: 568, width: 648, height: 568 },
});
const SIDE_MARGIN = 24;
// ScreenHeader's title bar and the hero button.
const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 72;

export function useNotificationPromptFrame() {
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const boxHeight = frame.height - insets.bottom;
  const coverScale = Math.max(
    frame.width / HINT_IMAGE.width,
    boxHeight / HINT_IMAGE.height
  );
  const imageLeft = (frame.width - HINT_IMAGE.width * coverScale) / 2;
  const imageTop = (boxHeight - HINT_IMAGE.height * coverScale) / 2;
  // On wide screens (tablets, foldables) covering the screen would blow the
  // prompt up over the header and the button, so keep it within the column,
  // below the header and body text, and above the button.
  const columnWidth = Math.min(frame.width, MAX_WIDTH) - 2 * SIDE_MARGIN;
  const minTop =
    insets.top + HEADER_HEIGHT + SIDE_MARGIN + BODY_TWO_LINES + BLOCK_GAP;
  const maxBottom = boxHeight - FOOTER_HEIGHT - SIDE_MARGIN;
  const scale = Math.min(
    coverScale,
    columnWidth / PROMPT_CROP.width,
    (maxBottom - minTop) / PROMPT_CROP.height
  );
  const height = PROMPT_CROP.height * scale;
  const coverTop = imageTop + PROMPT_CROP.y * coverScale;
  return {
    top: Math.min(Math.max(coverTop, minTop), maxBottom - height),
    width: PROMPT_CROP.width * scale,
    height,
    // How far the prompt's center sits from the middle of the screen.
    offsetX:
      (imageLeft +
        (PROMPT_CROP.x + PROMPT_CROP.width / 2) * coverScale -
        frame.width / 2) *
      (scale / coverScale),
  };
}

// Shared frame for the notification and setup steps at the end of signup:
// header, body text, the block (options, picture or steps), and a bottom slot
// sized for the hero button, which stays empty with no footer. The block
// starts where the notification prompt does, and the body text sits 48 pt
// above it. Longer text (large system sizes) pushes the block down instead of
// running under the header, and the middle scrolls if it no longer fits.
export function OnboardingStepLayout({
  title,
  body,
  footer,
  children,
}: PropsWithChildren<{ title: string; body: ReactNode; footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const { top: blockTop } = useNotificationPromptFrame();
  const contentTop = insets.top + HEADER_HEIGHT + SIDE_MARGIN;
  return (
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor="$secondaryBackground"
    >
      <ScreenHeader title={title} backgroundColor="$secondaryBackground" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: SIDE_MARGIN }}
        alwaysBounceVertical={false}
      >
        <StepColumn>
          <View
            minHeight={blockTop - BLOCK_GAP - contentTop}
            justifyContent="flex-end"
            marginBottom={BLOCK_GAP}
          >
            <TlonText.Text
              size="$body"
              color="$primaryText"
              minHeight={BODY_TWO_LINES}
            >
              {body}
            </TlonText.Text>
          </View>
          {children}
        </StepColumn>
      </ScrollView>
      <StepColumn>{footer ?? <View height="$6xl" />}</StepColumn>
    </View>
  );
}

function StepColumn({ children }: PropsWithChildren) {
  return (
    <View
      // Yoga drops cross-axis stretch when a horizontal margin is `auto`, so
      // without an explicit width this hugs its content.
      width="100%"
      maxWidth={MAX_WIDTH}
      marginHorizontal="auto"
      paddingHorizontal="$2xl"
    >
      {children}
    </View>
  );
}
