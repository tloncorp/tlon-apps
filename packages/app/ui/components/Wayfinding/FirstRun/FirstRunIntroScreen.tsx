import { View } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_CONTENT_GAP,
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
        icon: <LineIcon name={point.icon} />,
        label: point.label,
      }))}
    />
  );
}

/** Meet your Tlonbot and Yours to keep, the first run's opening pair. */
export function FirstRunIntroScreen({
  slide,
  onNext,
  onBack,
}: {
  slide: 1 | 2;
  onNext: () => void;
  onBack?: () => void;
}) {
  const glyph = useOnboardingGlyph();
  const copy = slide === 1 ? firstRunCopy.meet : firstRunCopy.private;
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
      testID={slide === 1 ? 'first-run-meet' : 'first-run-private'}
    >
      {slide === 1 ? <MeetArt glyph={glyph} /> : <PrivateArt glyph={glyph} />}
      <View marginTop={ART_TO_CONTENT_GAP}>
        <FeaturePointList points={copy.points} />
      </View>
    </LineStepFrame>
  );
}
