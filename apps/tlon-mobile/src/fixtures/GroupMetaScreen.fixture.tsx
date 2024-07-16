import { GroupMetaScreenView } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const GroupMetaScreenFixture = () => {
  return (
    <FixtureWrapper>
      <GroupMetaScreenView
        group={group}
        currentUserIsAdmin={true}
        deleteGroup={() => console.log('deleteGroup')}
        goBack={() => console.log('goBack')}
        setGroupMetadata={() => console.log('setGroupMetadata')}
        uploadAsset={async () => {}}
      />
    </FixtureWrapper>
  );
};

export default GroupMetaScreenFixture;
