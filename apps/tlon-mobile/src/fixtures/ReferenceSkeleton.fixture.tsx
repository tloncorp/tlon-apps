import ReferenceSkeleton from '@tloncorp/ui/src/components/ContentReference/ReferenceSkeleton';

import { FixtureWrapper } from './FixtureWrapper';

const ReferenceSkeletonFixture = () => {
  return (
    <FixtureWrapper fillWidth>
      <ReferenceSkeleton />
    </FixtureWrapper>
  );
};

export default {
  default: <ReferenceSkeletonFixture />,
};
