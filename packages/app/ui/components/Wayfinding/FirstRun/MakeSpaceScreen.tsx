import { FirstRunFrame } from './FirstRunFrame';
import { MAKE_SPACE_ART_HEIGHT, MakeSpaceArt } from './MakeSpaceArt';
import { firstRunCopy } from './firstRunCopy';
import type { FirstRunSetupStatus } from './types';

const copy = firstRunCopy.space;

/** Screen 5. Its button opens the Tlonbot DM, or the wait if setup isn't done. */
export function MakeSpaceScreen({
  status,
  onStart,
  onBack,
}: {
  status: FirstRunSetupStatus;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <FirstRunFrame
      step={5}
      art={<MakeSpaceArt />}
      artHeight={MAKE_SPACE_ART_HEIGHT}
      onBack={onBack}
      title={copy.title}
      accent={copy.accent}
      body={copy.body}
      status={status}
      primaryLabel={copy.primary}
      onPrimary={onStart}
      testID="first-run-space"
    />
  );
}
