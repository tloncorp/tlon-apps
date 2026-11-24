import { View } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TOP_GAP,
  ART_TO_BULLETS_GAP,
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

/**
 * Yours to keep's data link reads as the subtitle's next line: its tap area
 * reaches this far up into the subtitle's last line.
 */
const DATA_LINK_OVERLAP = 11;
/** The drawing then starts this far under the link's tap area. */
const DATA_LINK_TO_ART_GAP = 21;
/** Meet's drawing sits closer under its two-line subtitle, as on the canvas. */
const MEET_ART_TOP_GAP = 33;

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
      contentGap={
        slide === 1
          ? MEET_ART_TOP_GAP
          : dataLink
            ? -DATA_LINK_OVERLAP
            : ART_TOP_GAP
      }
      testID={slide === 1 ? 'first-run-meet' : 'first-run-private'}
    >
      {dataLink ? (
        <View marginBottom={DATA_LINK_TO_ART_GAP}>
          <LineTextLink
            label={firstRunCopy.private.dataLink}
            onPress={dataLink}
            testID="first-run-data-link"
          />
        </View>
      ) : null}
      {slide === 1 ? <MeetArt glyph={glyph} /> : <PrivateArt glyph={glyph} />}
      <View marginTop={ART_TO_BULLETS_GAP}>
        <FeaturePointList points={copy.points} />
      </View>
    </LineStepFrame>
  );
}
