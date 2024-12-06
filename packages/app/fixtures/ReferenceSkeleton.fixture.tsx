import { ReferenceSkeleton } from '@tloncorp/ui/src/components/ContentReference/Reference';

import { FixtureWrapper } from './FixtureWrapper';

const ReferenceSkeletonFixture = () => {
  return (
    <FixtureWrapper fillWidth>
      <ReferenceSkeleton />
    </FixtureWrapper>
  );
};

const ReferenceSkeletonErrorFixture = () => {
  return (
    <FixtureWrapper fillWidth>
      <ReferenceSkeleton
        messageType="error"
        message="An error has occurred while fetching this content"
      />
    </FixtureWrapper>
  );
};

const ReferenceSkeletonNotFoundFixture = () => {
  return (
    <FixtureWrapper fillWidth>
      <ReferenceSkeleton
        messageType="not-found"
        message="This content could not be found"
      />
    </FixtureWrapper>
  );
};

export default {
  default: <ReferenceSkeletonFixture />,
  error: <ReferenceSkeletonErrorFixture />,
  notFound: <ReferenceSkeletonNotFoundFixture />,
};
