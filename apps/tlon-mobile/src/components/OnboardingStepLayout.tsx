import { ScreenHeader, TlonText, View } from '@tloncorp/app/ui';
import { PropsWithChildren, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// Option rows on Notifications and step rows on the setup screen.
export const STEP_ROW_HEIGHT = 56;

const MAX_WIDTH = 600;
const BLOCK_GAP = 48;
// Body text takes at least two lines, so its first line stays put when the
// copy gets shorter.
const BODY_TWO_LINES = 48;

// Allow notifications used to show its permission prompt inside a full-screen
// picture (786 × 1704 px, scaled to cover the screen above the bottom inset).
// The prompt stays exactly where that put it, and the other steps line up to
// it: their options or steps start at its top edge.
const HINT_IMAGE = { width: 786, height: 1704 };
const PROMPT_CROP = Platform.select({
  ios: { x: 94, y: 614, width: 600, height: 552 },
  default: { x: 58, y: 568, width: 648, height: 568 },
});

export function useNotificationPromptFrame() {
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const boxHeight = frame.height - insets.bottom;
  const scale = Math.max(
    frame.width / HINT_IMAGE.width,
    boxHeight / HINT_IMAGE.height
  );
  const imageLeft = (frame.width - HINT_IMAGE.width * scale) / 2;
  const imageTop = (boxHeight - HINT_IMAGE.height * scale) / 2;
  return {
    top: imageTop + PROMPT_CROP.y * scale,
    width: PROMPT_CROP.width * scale,
    height: PROMPT_CROP.height * scale,
    // How far the prompt's center sits from the middle of the screen.
    offsetX:
      imageLeft +
      (PROMPT_CROP.x + PROMPT_CROP.width / 2) * scale -
      frame.width / 2,
  };
}

// Shared frame for the notification and setup steps at the end of signup:
// header, body text, the block (options, picture or steps), and a bottom slot
// sized for the hero button, which stays empty with no footer. The block
// starts where the notification prompt does, and the body text hangs 48 pt
// above it.
export function OnboardingStepLayout({
  title,
  body,
  footer,
  children,
}: PropsWithChildren<{ title: string; body: ReactNode; footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const { top: blockTop } = useNotificationPromptFrame();
  return (
    <View
      flex={1}
      paddingBottom={insets.bottom}
      backgroundColor="$secondaryBackground"
    >
      <ScreenHeader title={title} backgroundColor="$secondaryBackground" />
      <View flex={1} />
      <StepColumn>{footer ?? <View height="$6xl" />}</StepColumn>
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        height={blockTop - BLOCK_GAP}
        justifyContent="flex-end"
        pointerEvents="box-none"
      >
        <StepColumn>
          <TlonText.Text
            size="$body"
            color="$primaryText"
            minHeight={BODY_TWO_LINES}
          >
            {body}
          </TlonText.Text>
        </StepColumn>
      </View>
      <View
        position="absolute"
        top={blockTop}
        left={0}
        right={0}
        pointerEvents="box-none"
      >
        <StepColumn>{children}</StepColumn>
      </View>
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
