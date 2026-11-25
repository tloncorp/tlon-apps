import { View } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_BULLETS_GAP,
  LineBulletList,
  LineStepFrame,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { MeetArt, PrivateArt } from '../../Onboarding/line/onboardingArt';
import {
  FIRST_RUN_STEPS,
  type FeaturePoint,
  firstRunCopy,
} from './firstRunCopy';

export function FeaturePointList({ points }: { points: FeaturePoint[] }) {
  return (
    <LineBulletList
      items={points.map((point) => ({
        icon: <LineIcon name={point.icon} size={24} />,
        label: point.label,
      }))}
    />
  );
}

/** The drawing sits this close under the subtitle. */
const INTRO_ART_TOP_GAP = 33;

/**
 * Meet your Sato and Yours to keep, the first run's opening pair. Yours to
 * keep links to How your data is kept from under its main button.
 */
export function FirstRunIntroScreen({
  slide,
  onNext,
  onBack,
  onDataKept,
}: {
  slide: 1 | 2;
  onNext: () => void;
  onBack?: () => void;
  onDataKept?: () => void;
}) {
  const glyph = useOnboardingGlyph();
  const copy = slide === 1 ? firstRunCopy.meet : firstRunCopy.private;
  const dataLink = slide === 2 ? onDataKept : undefined;
  return (
    <LineStepFrame
      step={slide === 1 ? FIRST_RUN_STEPS.meet : FIRST_RUN_STEPS.private}
      onBack={onBack}
      title={copy.title}
      subtitle={copy.subtitle}
      primary={{
        label: copy.primary,
        onPress: onNext,
        testID: 'first-run-primary',
      }}
      secondary={
        dataLink
          ? {
              label: firstRunCopy.private.dataLink,
              onPress: dataLink,
              testID: 'first-run-data-link',
            }
          : undefined
      }
      contentGap={INTRO_ART_TOP_GAP}
      testID={slide === 1 ? 'first-run-meet' : 'first-run-private'}
    >
      {slide === 1 ? <MeetArt glyph={glyph} /> : <PrivateArt glyph={glyph} />}
      <View marginTop={ART_TO_BULLETS_GAP}>
        <FeaturePointList points={copy.points} />
      </View>
    </LineStepFrame>
  );
}
