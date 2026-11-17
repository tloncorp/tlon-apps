import { View } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_CONTENT_GAP,
  LineBulletList,
  LineStepFrame,
  LineTextLink,
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

/** The data link sits this far under Yours to keep's last point. */
const LIST_TO_DATA_LINK_GAP = 38;

/**
 * Meet your Tlonbot and Yours to keep, the first run's opening pair. Yours
 * to keep links to How your data is kept.
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
      {slide === 2 && onDataKept ? (
        <View marginTop={LIST_TO_DATA_LINK_GAP}>
          <LineTextLink
            label={firstRunCopy.private.dataLink}
            onPress={onDataKept}
            testID="first-run-data-link"
          />
        </View>
      ) : null}
    </LineStepFrame>
  );
}
