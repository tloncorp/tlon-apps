import { useWindowDimensions } from 'react-native';
import { View } from 'tamagui';

import { MeetYourBotArt } from '../MeetYourBot/MeetYourBotArt';
import { FeaturePointList } from './FeaturePoints';
import { FirstRunFrame } from './FirstRunFrame';
import { firstRunCopy } from './firstRunCopy';
import type { FirstRunSetupStatus } from './types';

/** Screens 1 and 2: the shipped Meet your Tlonbot slides, as steps of five. */
export function FirstRunIntroScreen({
  slide,
  status,
  onNext,
  onBack,
}: {
  slide: 1 | 2;
  status: FirstRunSetupStatus;
  onNext: () => void;
  onBack?: () => void;
}) {
  const { width } = useWindowDimensions();
  const copy = slide === 1 ? firstRunCopy.meet : firstRunCopy.private;
  return (
    <FirstRunFrame
      step={slide}
      art={<MeetYourBotArt key={slide} slide={slide} width={width} />}
      onBack={onBack}
      title={copy.title}
      accent={copy.accent}
      // Setup starts behind slide 1; the status line takes over from slide 2.
      status={slide === 1 ? null : status}
      primaryLabel={copy.primary}
      onPrimary={onNext}
      testID={slide === 1 ? 'first-run-meet' : 'first-run-private'}
    >
      <View marginTop={20}>
        <FeaturePointList points={copy.points} />
      </View>
    </FirstRunFrame>
  );
}
