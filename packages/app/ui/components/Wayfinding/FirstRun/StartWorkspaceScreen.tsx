import { View } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_CONTENT_GAP,
  LineStepFrame,
} from '../../Onboarding/line/LineStepFrame';
import { WorkspaceArt } from '../../Onboarding/line/onboardingArt';
import { FeaturePointList } from './FirstRunIntroScreen';
import { FIRST_RUN_STEPS, firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.workspace;

/**
 * The first run's last screen: the workspace onboarding sets up. Both buttons
 * open the Tlonbot DM, or the wait if setup isn't done; Invite friends then
 * opens the workspace's invite screen.
 */
export function StartWorkspaceScreen({
  onInvite,
  onSkip,
  onBack,
}: {
  onInvite: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const glyph = useOnboardingGlyph();
  return (
    <LineStepFrame
      step={FIRST_RUN_STEPS.workspace}
      onBack={onBack}
      title={copy.title}
      subtitle={copy.subtitle}
      primary={{
        label: copy.primary,
        onPress: onInvite,
        testID: 'first-run-invite',
      }}
      secondary={{
        label: copy.secondary,
        onPress: onSkip,
        testID: 'first-run-skip',
      }}
      testID="first-run-workspace"
    >
      <WorkspaceArt glyph={glyph} />
      <View marginTop={ART_TO_CONTENT_GAP}>
        <FeaturePointList points={copy.points} />
      </View>
    </LineStepFrame>
  );
}
